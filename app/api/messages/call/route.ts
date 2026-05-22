import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { admin } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { targetUserId, event, ...data } = await req.json();

    if (!targetUserId || !event) {
      return NextResponse.json({ error: 'Missing targetUserId or event' }, { status: 400 });
    }

    // 1. Trigger the dynamic event on the target user's private Pusher channel (for active app sessions)
    await pusherServer.trigger(`private-user-${targetUserId}`, event, data);

    // 2. If this is an incoming-call, send an FCM push notification to wake the phone and trigger the native dialer
    if (event === 'incoming-call') {
      const recipient = await db.query.users.findFirst({
        where: eq(schema.users.id, targetUserId)
      });

      if (recipient?.fcmToken) {
        // Fetch the caller's latest details to show real name & profile picture on the call screen
        const caller = await db.query.users.findFirst({
          where: eq(schema.users.id, data.caller.id)
        });

        const callerName = caller?.name || data.caller.name || 'Someone';
        const callerAvatar = caller?.profilePicture || caller?.avatar || data.caller.avatar || '';

        try {
          await admin.messaging().send({
            token: recipient.fcmToken,
            data: {
              type: 'incoming_call',
              callerId: data.caller.id,
              callerName: callerName,
              avatarUrl: callerAvatar,
              channelName: data.channelName,
              callType: data.type || 'voice'
            },
            android: {
              priority: 'high',
              ttl: 24 * 60 * 60 * 1000 // Retain for 24 hours max
            }
          });
          console.log(`[FCM Call Push] Successfully sent incoming_call push to user ${targetUserId}`);
        } catch (pushErr) {
          console.error('[FCM Call Push] Failed to send push notification:', pushErr);
        }
      } else {
        console.log(`[FCM Call Push] Recipient ${targetUserId} has no FCM token registered.`);
      }
    } else if (event === 'call-ended' || event === 'call-rejected') {
      const recipient = await db.query.users.findFirst({
        where: eq(schema.users.id, targetUserId)
      });

      if (recipient?.fcmToken) {
        try {
          await admin.messaging().send({
            token: recipient.fcmToken,
            data: {
              type: event === 'call-ended' ? 'call_ended' : 'call_rejected',
              callerId: targetUserId
            },
            android: {
              priority: 'high',
              ttl: 60 * 1000 // Very short TTL (1 minute) for call terminations
            }
          });
          console.log(`[FCM Call Termination Push] Successfully sent ${event} push to user ${targetUserId}`);
        } catch (pushErr) {
          console.error('[FCM Call Termination Push] Failed to send push notification:', pushErr);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Pusher/FCM Signaling Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

