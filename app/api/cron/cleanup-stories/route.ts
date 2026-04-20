import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { lt } from 'drizzle-orm';

// This is a secure endpoint that should ideally be protected by a secret key
export async function GET(request: Request) {
  try {
    // Basic security check (Optional: uncomment to secure the route)
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new NextResponse('Unauthorized', { status: 401 });
    // }

    // Calculate the time exactly 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Delete slides older than 24 hours
    const deleted = await db.delete(schema.storySlides)
      .where(lt(schema.storySlides.createdAt, twentyFourHoursAgo));

    return NextResponse.json({ 
      success: true, 
      message: 'Old stories cleaned up successfully' 
    });
  } catch (error) {
    console.error('Failed to cleanup stories:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
