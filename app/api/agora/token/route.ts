import { NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

export async function POST(req: Request) {
  try {
    const { channelName, uid } = await req.json();

    if (!channelName) {
      return NextResponse.json({ error: 'channelName is required' }, { status: 400 });
    }

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      console.log('[Agora Token API] App ID or App Certificate is missing in environment variables. Falling back to tokenless mode.');
      return NextResponse.json({ token: null, isTokenless: true });
    }

    const role = RtcRole.PUBLISHER;
    // Expire token in 2 hours
    const expirationTimeInSeconds = 7200;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Use numeric uid if provided, otherwise default to 0 (which allows joining with any integer UID)
    const numericUid = typeof uid === 'number' ? uid : 0;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      numericUid,
      role,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    console.log(`[Agora Token API] Generated token for channel "${channelName}" (uid: ${numericUid})`);
    return NextResponse.json({ token, isTokenless: false });
  } catch (err: any) {
    console.error('[Agora Token API] Error generating token:', err);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
