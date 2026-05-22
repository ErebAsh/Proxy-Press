package com.proxypress.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import android.app.ActivityManager;
import java.util.List;
import android.media.AudioAttributes;
import android.net.Uri;
import android.media.RingtoneManager;

public class CustomPushService extends MessagingService {

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        // Let Capacitor handle foreground events
        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        
        // Handle Call Cancellation/Ended notifications from the backend
        if (data.containsKey("type") && (data.get("type").equals("call_ended") || data.get("type").equals("call_rejected"))) {
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancel(101);
            }
            Intent stopCallIntent = new Intent("ACTION_STOP_RINGING");
            sendBroadcast(stopCallIntent);
            return;
        }
        
        // 1. Calls must ring natively ONLY when the app is in the background or closed
        if (data.containsKey("type") && data.get("type").equals("incoming_call")) {
            if (isAppInForeground()) {
                // If the app is active in the foreground, let the Next.js Webview/Pusher handler
                // exclusively display the elegant in-app CallOverlay, avoiding dual/conflicting UIs.
                return;
            }
            String callerId = data.containsKey("callerId") ? data.get("callerId") : "";
            String callerName = data.containsKey("callerName") ? data.get("callerName") : "Incoming Call";
            String avatarUrl = data.containsKey("avatarUrl") ? data.get("avatarUrl") : "";
            String channelName = data.containsKey("channelName") ? data.get("channelName") : "";
            String callType = data.containsKey("callType") ? data.get("callType") : "voice";

            triggerIncomingCallNotification(callerId, callerName, avatarUrl, channelName, callType);
            return;
        }

        // 2. Standard text messages are ignored in foreground to let Capacitor handle them
        if (isAppInForeground()) {
            return; 
        }

        if (data.containsKey("type") && data.get("type").equals("message")) {
            String title = data.containsKey("title") ? data.get("title") : "New Message";
            String body = data.containsKey("body") ? data.get("body") : "";
            String avatarUrl = data.containsKey("avatarUrl") ? data.get("avatarUrl") : "";
            String conversationId = data.containsKey("conversationId") ? data.get("conversationId") : "";

            sendNotification(title, body, avatarUrl, conversationId);
        }
    }

    private void triggerIncomingCallNotification(String callerId, String callerName, String avatarUrl, String channelName, String callType) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "voip_call_channel";
        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (ringtoneUri == null) {
            ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId, 
                "Incoming Calls", 
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Full-screen incoming call dialer and ringtone notification");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 1000, 800, 1000});

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build();
            channel.setSound(ringtoneUri, audioAttributes);
            notificationManager.createNotificationChannel(channel);
        }

        // Check if device screen is locked
        android.app.KeyguardManager keyguardManager = (android.app.KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        boolean isLocked = keyguardManager != null && keyguardManager.isKeyguardLocked();

        // Build Decline Intent (runs in background via CallActionReceiver)
        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction("ACTION_DECLINE");
        declineIntent.putExtra("callerId", callerId);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
            this, 
            102, 
            declineIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );

        // Build Accept Intent (opens MainActivity to answer call)
        Intent acceptIntent = new Intent(this, MainActivity.class);
        acceptIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        acceptIntent.putExtra("acceptCall", true);
        acceptIntent.putExtra("channelName", channelName);
        acceptIntent.putExtra("callerId", callerId);
        acceptIntent.putExtra("callerName", callerName);
        acceptIntent.putExtra("callType", callType);
        PendingIntent acceptPendingIntent = PendingIntent.getActivity(
            this, 
            103, 
            acceptIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );

        // Build CallActivity intent
        Intent callIntent = new Intent(this, IncomingCallActivity.class);
        callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        callIntent.putExtra("callerId", callerId);
        callIntent.putExtra("callerName", callerName);
        callIntent.putExtra("avatarUrl", avatarUrl);
        callIntent.putExtra("channelName", channelName);
        callIntent.putExtra("callType", callType);

        int smallIcon = getResources().getIdentifier("ic_stat_name", "drawable", getPackageName());
        if (smallIcon == 0) smallIcon = getApplicationInfo().icon;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(smallIcon)
                .setContentTitle("Incoming call")
                .setContentText(callerName + " is calling you")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setOngoing(true)
                .setSound(ringtoneUri)
                .setColor(android.graphics.Color.parseColor("#0F172A"))
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
                .addAction(android.R.drawable.ic_menu_call, "Accept", acceptPendingIntent);

        if (isLocked) {
            // Screen is locked: Wake screen and launch full screen activity dialer
            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this, 
                101, 
                callIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
            );
            builder.setFullScreenIntent(fullScreenPendingIntent, true);
        } else {
            // Screen is unlocked: Show non-disruptive heads-up banner
            PendingIntent normalPendingIntent = PendingIntent.getActivity(
                this, 
                104, 
                callIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
            );
            builder.setContentIntent(normalPendingIntent);
        }

        notificationManager.notify(101, builder.build());
    }

    private boolean isAppInForeground() {
        ActivityManager activityManager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        List<ActivityManager.RunningAppProcessInfo> appProcesses = activityManager.getRunningAppProcesses();
        if (appProcesses == null) return false;
        
        final String packageName = getPackageName();
        for (ActivityManager.RunningAppProcessInfo appProcess : appProcesses) {
            if (appProcess.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND && appProcess.processName.equals(packageName)) {
                return true;
            }
        }
        return false;
    }

    private void sendNotification(String title, String body, String avatarUrl, String conversationId) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "default_channel";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Messages", NotificationManager.IMPORTANCE_HIGH);
            notificationManager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("conversationId", conversationId);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);

        int smallIcon = getResources().getIdentifier("ic_stat_name", "drawable", getPackageName());
        if (smallIcon == 0) smallIcon = getApplicationInfo().icon;

        Person.Builder personBuilder = new Person.Builder()
                .setName(title);

        if (avatarUrl != null && !avatarUrl.isEmpty()) {
            Bitmap bitmap = getBitmapFromURL(avatarUrl);
            if (bitmap != null) {
                personBuilder.setIcon(IconCompat.createWithBitmap(getCircularBitmap(bitmap)));
            }
        }
        
        Person sender = personBuilder.build();
        
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(sender)
                .addMessage(body, System.currentTimeMillis(), sender);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(smallIcon)
                .setStyle(style)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setColor(android.graphics.Color.parseColor("#0F172A"));

        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
    }

    private Bitmap getBitmapFromURL(String strURL) {
        try {
            URL url = new URL(strURL);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setDoInput(true);
            connection.connect();
            InputStream input = connection.getInputStream();
            return BitmapFactory.decodeStream(input);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private Bitmap getCircularBitmap(Bitmap bitmap) {
        Bitmap output = Bitmap.createBitmap(bitmap.getWidth(), bitmap.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);
        final int color = 0xff424242;
        final Paint paint = new Paint();
        final Rect rect = new Rect(0, 0, bitmap.getWidth(), bitmap.getHeight());
        final RectF rectF = new RectF(rect);

        paint.setAntiAlias(true);
        canvas.drawARGB(0, 0, 0, 0);
        paint.setColor(color);
        canvas.drawOval(rectF, paint);

        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(bitmap, rect, rect, paint);
        return output;
    }
}
