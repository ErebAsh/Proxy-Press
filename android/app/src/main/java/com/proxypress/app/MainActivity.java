package com.proxypress.app;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private NativeSplashView splashView;
    private String pendingCallJson = null;
    private String pendingIncomingCallJson = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Guaranteed Space: Calculate status bar height and apply as padding
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            int statusBarHeight = getResources().getDimensionPixelSize(resourceId);
            findViewById(android.R.id.content).setPadding(0, statusBarHeight, 0, 0);
        }
        
        showNativeSplash();
        
        // Delay the painting slightly to ensure the window is ready
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::paintWebViewBackground, 100);
        
        // Add JS interfaces immediately to make sure they are loaded before the web page starts executing
        try {
            if (this.getBridge() != null && this.getBridge().getWebView() != null) {
                this.getBridge().getWebView().addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void hide() {
                        hideNativeSplash();
                    }
                }, "AndroidNativeSplash");

                this.getBridge().getWebView().addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public String getPendingAcceptedCall() {
                        return pendingCallJson;
                    }

                    @JavascriptInterface
                    public void clearPendingAcceptedCall() {
                        pendingCallJson = null;
                    }

                    @JavascriptInterface
                    public String getPendingIncomingCall() {
                        return pendingIncomingCallJson;
                    }

                    @JavascriptInterface
                    public void clearPendingIncomingCall() {
                        pendingIncomingCallJson = null;
                    }
                }, "AndroidCallBridge");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        
    }

    private void showNativeSplash() {
        if (isFinishing()) return;
        
        splashView = new NativeSplashView(this);
        addContentView(splashView, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        // Emergency Escape: If user taps the screen, hide it
        splashView.setOnClickListener(v -> hideNativeSplash());

        // Safety: Auto-hide after 6 seconds if everything fails
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::hideNativeSplash, 6000);
    }

    public void hideNativeSplash() {
        runOnUiThread(() -> {
            if (splashView != null) {
                splashView.animate()
                    .alpha(0f)
                    .setDuration(500)
                    .withEndAction(() -> {
                        if (splashView != null && splashView.getParent() != null) {
                            ((ViewGroup) splashView.getParent()).removeView(splashView);
                            splashView = null;
                        }
                    });
            }
        });
    }

    // New method to pre-paint the WebView and Window background to kill the white flash
    private void paintWebViewBackground() {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            
            // Check for custom theme first (try both prefixed and non-prefixed)
            String customThemeJson = prefs.getString("proxy-press-custom-theme", null);
            if (customThemeJson == null) customThemeJson = prefs.getString("_cap_proxy-press-custom-theme", null);
            
            int bgColor = Color.parseColor("#000000"); // Default dark
            boolean isDark = true;
            
            if (customThemeJson != null) {
                try {
                    // Robust Regex for 3, 6, or 8-digit hex codes
                    java.util.regex.Matcher bgMatcher = java.util.regex.Pattern.compile("\"bg\":\"(#[A-Fa-f0-9]+)\"").matcher(customThemeJson);
                    if (bgMatcher.find()) {
                        String colorStr = bgMatcher.group(1);
                        bgColor = Color.parseColor(colorStr);
                    }
                    
                    // Estimate if the background is dark or light for icon contrast
                    double darkness = 1 - (0.299 * Color.red(bgColor) + 0.587 * Color.green(bgColor) + 0.114 * Color.blue(bgColor)) / 255;
                    isDark = darkness > 0.5;
                } catch (Exception e) {
                    // If parsing fails, stick to defaults
                }
            } else {
                // Check for light/dark mode preference
                String themeMode = prefs.getString("proxy-press-theme", null);
                if (themeMode == null) themeMode = prefs.getString("_cap_proxy-press-theme", "system");
                
                if ("system".equals(themeMode)) {
                    isDark = (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
                } else {
                    isDark = "dark".equals(themeMode);
                }
                bgColor = isDark ? Color.parseColor("#000000") : Color.parseColor("#F8FAFC");
            }
            
            final int finalColor = bgColor;
            final boolean finalIsDark = isDark;
            runOnUiThread(() -> {
                // 1. Paint the WebView background
                if (this.getBridge() != null && this.getBridge().getWebView() != null) {
                    this.getBridge().getWebView().setBackgroundColor(finalColor);
                }
                
                // 2. Paint the Window background
                getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(finalColor));
                
                // 3. Paint the DecorView (the absolute root)
                getWindow().getDecorView().setBackgroundColor(finalColor);
            });
        } catch (Exception e) {}
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCallIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        handleCallIntent(getIntent());
    }

    private void handleCallIntent(Intent intent) {
        if (intent != null) {
            android.app.NotificationManager notificationManager = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancel(101);
            }

            if (intent.getBooleanExtra("acceptCall", false)) {
                String channelName = intent.getStringExtra("channelName");
                String callerId = intent.getStringExtra("callerId");
                String callerName = intent.getStringExtra("callerName");
                String callType = intent.getStringExtra("callType");
                
                intent.removeExtra("acceptCall");
                
                pendingCallJson = "{\"channel\":\"" + (channelName != null ? channelName : "") + "\",\"callerId\":\"" + (callerId != null ? callerId : "") + "\",\"callerName\":\"" + (callerName != null ? callerName : "") + "\",\"callType\":\"" + (callType != null ? callType : "") + "\"}";
                
                triggerWebviewCallAccept(channelName, callerId, callerName, callType);
            } else if (intent.getBooleanExtra("incomingCall", false)) {
                String channelName = intent.getStringExtra("channelName");
                String callerId = intent.getStringExtra("callerId");
                String callerName = intent.getStringExtra("callerName");
                String callType = intent.getStringExtra("callType");
                
                intent.removeExtra("incomingCall");
                
                pendingIncomingCallJson = "{\"channel\":\"" + (channelName != null ? channelName : "") + "\",\"callerId\":\"" + (callerId != null ? callerId : "") + "\",\"callerName\":\"" + (callerName != null ? callerName : "") + "\",\"callType\":\"" + (callType != null ? callType : "") + "\"}";
                
                triggerWebviewCallIncoming(channelName, callerId, callerName, callType);
            }
        }
    }

    private void triggerWebviewCallAccept(String channel, String callerId, String callerName, String callType) {
        new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
            try {
                if (this.getBridge() != null && this.getBridge().getWebView() != null) {
                    String js = "window.dispatchEvent(new CustomEvent('native-call-accepted', { detail: { channel: '" + channel + "', callerId: '" + callerId + "', callerName: '" + callerName + "', callType: '" + callType + "' } }));";
                    this.getBridge().getWebView().evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void triggerWebviewCallIncoming(String channel, String callerId, String callerName, String callType) {
        new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
            try {
                if (this.getBridge() != null && this.getBridge().getWebView() != null) {
                    String js = "window.dispatchEvent(new CustomEvent('native-call-incoming', { detail: { channel: '" + channel + "', callerId: '" + callerId + "', callerName: '" + callerName + "', callType: '" + callType + "' } }));";
                    this.getBridge().getWebView().evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }
}
