
package org.olgsoft.apipepanic;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.graphics.Canvas;
import android.graphics.Insets;
import android.graphics.BitmapFactory;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.Base64;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import androidx.core.content.FileProvider;
import android.content.Intent;
import android.content.res.Resources;
import android.os.Build;
import android.graphics.Typeface;
import android.view.ViewGroup;
import java.util.Locale;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;

import androidx.core.view.GravityCompat;
import androidx.drawerlayout.widget.DrawerLayout;

import android.util.Log;
import android.view.View;
import android.view.DisplayCutout;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.WindowManager.LayoutParams;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.CheckBox;
import android.widget.SeekBar;
import android.widget.TextView;
import org.olgsoft.apipepanic.updates.HaokeUpdateUi;

public class MainActivity extends Activity {

    private WebView mWebView;
    private View displaySurface;
    private DrawerLayout drawerLayout;
    private boolean helpActive;
    private boolean foreground;
    private boolean pageReady;
    private boolean hasPlayed;
    private boolean drawerPaused = true;
    private static final String GAME_URL = "file:///android_asset/jspp/index.html";
    private static final String GAME_MENU = "pipepanic:menu";
    private SeekBar battlemodeseed;
    private SeekBar difficulty;
    private Resources uiResources;
    private String gameLanguage;
    private Typeface uiTypeface;
    private HaokeUpdateUi updates;
    private boolean nativeModal;

    private void applyLanguage() {
        Configuration system = Resources.getSystem().getConfiguration();
        Locale primary = Build.VERSION.SDK_INT >= 24 && !system.getLocales().isEmpty()
                ? system.getLocales().get(0) : system.locale;
        Locale locale = primary != null && "zh".equals(primary.getLanguage())
                ? Locale.SIMPLIFIED_CHINESE : Locale.ENGLISH;
        gameLanguage = locale.getLanguage();
        Configuration localized = new Configuration(getResources().getConfiguration());
        if (Build.VERSION.SDK_INT >= 17) {
            localized.setLocale(locale);
            uiResources = createConfigurationContext(localized).getResources();
        } else {
            localized.locale = locale;
            getResources().updateConfiguration(localized, getResources().getDisplayMetrics());
            uiResources = getResources();
        }

        setTitle(uiResources.getString(R.string.app_name));
        int[] views = { R.id.welcome, R.id.newgame_button, R.id.fullscreen_checkbox,
                R.id.share_button, R.id.clear_highscore, R.id.about_button, R.id.challenge_hint, R.id.resume_button, R.id.levels_button };
        int[] labels = { R.string.welcome, R.string.startnewgame, R.string.toggle_fullscreen,
                R.string.share_screenshot, R.string.clear_highscore, R.string.about, R.string.challenge_hint, R.string.resume, R.string.levels };
        for (int i = 0; i < views.length; i++) {
            ((TextView) findViewById(views[i])).setText(uiResources.getString(labels[i]));
        }
        findViewById(R.id.seed_minus).setContentDescription(uiResources.getString(R.string.decrease_seed));
        findViewById(R.id.seed_plus).setContentDescription(uiResources.getString(R.string.increase_seed));
        updateGameOptions();
        updateWebLanguage();
    }

    private void updateGameOptions() {
        int seed = battlemodeseed.getProgress();
        String number = seed == 0 ? uiResources.getString(R.string.off) : Integer.toString(seed);
        ((TextView) findViewById(R.id.battlemodetext)).setText(uiResources.getString(R.string.battlemode, number));
        String level = uiResources.getStringArray(R.array.difficulties)[difficulty.getProgress()];
        ((TextView) findViewById(R.id.difficultytext)).setText(uiResources.getString(R.string.difficulty, level));
    }

    private void updateWebLanguage() {
        runGameScript("setGameLanguage('" + gameLanguage + "')");
    }

    private void applyTypeface(View view) {
        if (view instanceof TextView) {
            TextView label = (TextView) view;
            Typeface old = label.getTypeface();
            label.setTypeface(uiTypeface, old == null ? Typeface.NORMAL : old.getStyle());
        } else if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) applyTypeface(group.getChildAt(i));
        }
    }


    private class MyWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            if ("pipepanic:updates".equals(url)) {
                if (updates != null && helpActive && foreground) {
                    Toast.makeText(MainActivity.this, uiResources.getString(R.string.updates_checking), Toast.LENGTH_SHORT).show();
                    updates.manual();
                }
                return true;
            }
            if (GAME_MENU.equals(url)) {
                if (helpActive) hideHelp();
                drawerLayout.openDrawer(GravityCompat.START);
                return true;
            }
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme();
            if (!"https".equals(scheme) && !"http".equals(scheme)) return true;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
            } catch (ActivityNotFoundException e) {
                Toast.makeText(MainActivity.this, uiResources.getString(R.string.no_browser),
                        Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (!GAME_URL.equals(url)) return;
            pageReady = true;
            updateWebLanguage();
            updatePauseState();
            findViewById(R.id.newgame_button).setEnabled(true);
            findViewById(R.id.about_button).setEnabled(true);
            findViewById(R.id.levels_button).setEnabled(true);
            if (updates != null) updates.refresh();
        }
    }

    @SuppressLint({"SetJavaScriptEnabled"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Don't show an action bar or title
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        getWindow().setFlags(LayoutParams.FLAG_HARDWARE_ACCELERATED,
                LayoutParams.FLAG_HARDWARE_ACCELERATED);


        setContentView(R.layout.activity_main);
        displaySurface = findViewById(R.id.display_surface);
        configureDisplayInsets();

        // build a drawer

        drawerLayout = (DrawerLayout) findViewById(R.id.drawer_layout);
        drawerLayout.addDrawerListener(new DrawerLayout.SimpleDrawerListener() {
            @Override
            public void onDrawerSlide(View drawerView, float slideOffset) {
                if ((slideOffset > 0) != drawerPaused) {
                    updatePauseState();
                }
            }

            @Override
            public void onDrawerClosed(View drawerView) {
                updatePauseState();
            }

            @Override
            public void onDrawerOpened(View drawerView) {
                if (helpActive) hideHelp();
                updatePauseState();
            }
        });
        applyFullScreen(null);

        // Load webview with game
        mWebView = (WebView) findViewById(R.id.mainWebView);
        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        // Debug-only inspection of this task's own WebView on the bound QA phone.
        if (android.os.Build.VERSION.SDK_INT >= 19) {
            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        }
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setSupportZoom(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(false);

        mWebView.setVerticalScrollBarEnabled(false);
        mWebView.setHorizontalScrollBarEnabled(false);

        mWebView.setWebViewClient(new MyWebViewClient());

        mWebView.setWebChromeClient(new WebChromeClient() {
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d("PipePanic", cm.message() + " -- From line "
                        + cm.lineNumber() + " of "
                        + cm.sourceId());
                return true;
            }
        });

        battlemodeseed = (SeekBar) findViewById(R.id.battlemodeseed);
        difficulty = (SeekBar) findViewById(R.id.difficulty);
        battlemodeseed.setProgress(0);
        difficulty.setProgress(1);
        applyLanguage();
        uiTypeface = Typeface.createFromAsset(getAssets(), "jspp/PipeNoto.ttf");
        applyTypeface(drawerLayout);
        updates = new HaokeUpdateUi(this, new HaokeUpdateUi.Host() {
            @Override public boolean isSafeForUpdates(boolean manual) {
                return updateRouteEligible(foreground, pageReady, hasWindowFocus(), nativeModal,
                        drawerLayout.isDrawerOpen(GravityCompat.START), helpActive, manual);
            }
            @Override public void onDialogShown(AlertDialog dialog) {
                applyTypeface(dialog.getWindow().getDecorView());
            }
        });

        SeekBar.OnSeekBarChangeListener optionListener = new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar bar, int progress, boolean user) {
                updateGameOptions();
            }
            @Override public void onStartTrackingTouch(SeekBar bar) {}
            @Override public void onStopTrackingTouch(SeekBar bar) {}
        };
        battlemodeseed.setOnSeekBarChangeListener(optionListener);
        difficulty.setOnSeekBarChangeListener(optionListener);
        mWebView.loadUrl(GAME_URL);
        drawerLayout.openDrawer(GravityCompat.START);
    }

    public void increase_battlemode(View v) {
        battlemodeseed.setProgress(battlemodeseed.getProgress() + 1);
    }

    public void decrease_battlemode(View v) {
        battlemodeseed.setProgress(battlemodeseed.getProgress() - 1);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyLanguage();
    }

    @Override
    public void onBackPressed() {
        if (helpActive) {
            hideHelp();
            drawerLayout.openDrawer(GravityCompat.START);
        } else if (!drawerLayout.isDrawerOpen(GravityCompat.START)) {
            drawerLayout.openDrawer(GravityCompat.START);
        } else if (hasPlayed) {
            drawerLayout.closeDrawer(GravityCompat.START);
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        mWebView.onResume();
        foreground = true;
        updatePauseState();
        if (updates != null) updates.resume();
    }

    @Override
    protected void onPause() {
        foreground = false;
        if (updates != null) updates.pause();
        updatePauseState();
        mWebView.onPause();
        super.onPause();
    }

    static boolean updateRouteEligible(boolean foreground, boolean ready, boolean focused,
            boolean modal, boolean menuOpen, boolean help, boolean manual) {
        return foreground && ready && focused && !modal && (manual ? help : menuOpen && !help);
    }

    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (updates != null) updates.refresh();
    }

    @Override protected void onDestroy() {
        if (updates != null) updates.close();
        if (mWebView != null) mWebView.destroy();
        super.onDestroy();
    }

    private void runGameScript(String script) {
        if (!pageReady) return;
        if (Build.VERSION.SDK_INT >= 19) mWebView.evaluateJavascript(script, null);
        else mWebView.loadUrl("javascript:void(" + script + ")");
    }

    private void updatePauseState() {
        drawerPaused = drawerLayout.isDrawerVisible(GravityCompat.START);
        boolean paused = !foreground || drawerPaused || helpActive;
        if (pageReady && !paused) markGameStarted();
        runGameScript(paused ? "pauseGame()" : "resumeGame()");
        if (updates != null) updates.refresh();
    }

    private void markGameStarted() {
        if (!hasPlayed) {
            hasPlayed = true;
            findViewById(R.id.resume_button).setVisibility(View.VISIBLE);
        }
    }

    public void shareScreenShot(View v) {
        if (!pageReady || mWebView.getWidth() == 0 || mWebView.getHeight() == 0) return;
        if (Build.VERSION.SDK_INT >= 19) {
            v.setEnabled(false);
            mWebView.evaluateJavascript("typeof PumpBoard === 'undefined' ? '' : PumpBoard.capture()", response -> {
                v.setEnabled(true);
                if (!isFinishing() && foreground) writeScreenshot(response);
            });
        } else {
            writeScreenshot(null);
        }
    }

    private void compositeScreenshotLayers(Canvas canvas, Bitmap bitmap, String response)
            throws JSONException, IOException {
        if (response == null) return;
        Object value = new JSONTokener(response).nextValue();
        if (!(value instanceof String)) throw new IOException("3D screenshot unavailable");
        String json = (String) value;
        if (json.isEmpty()) return;
        JSONObject capture = new JSONObject(json);
        float scale = bitmap.getWidth() / (float) capture.getDouble("width");
        JSONArray layers = capture.getJSONArray("layers");
        Paint paint = new Paint(Paint.FILTER_BITMAP_FLAG);
        for (int i = 0; i < layers.length(); i++) {
            JSONObject layer = layers.getJSONObject(i);
            byte[] bytes = Base64.decode(layer.getString("png"), Base64.DEFAULT);
            Bitmap content = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (content == null) throw new IOException("3D screenshot could not be decoded");
            try {
                float x = (float) layer.getDouble("left");
                float y = (float) layer.getDouble("top");
                float right = x + (float) layer.getDouble("width");
                float bottom = y + (float) layer.getDouble("height");
                canvas.drawBitmap(content, null,
                        new RectF(x * scale, y * scale, right * scale, bottom * scale), paint);
            } finally {
                content.recycle();
            }
        }
    }

    private void writeScreenshot(String response) {
        Bitmap bitmap = null;
        try {
            int width = mWebView.getWidth();
            int height = mWebView.getHeight();
            float scale = Math.min(1f, 2048f / Math.max(width, height));
            bitmap = Bitmap.createBitmap(Math.max(1, Math.round(width * scale)),
                    Math.max(1, Math.round(height * scale)), Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.save();
            canvas.scale(scale, scale);
            mWebView.draw(canvas);
            canvas.restore();
            compositeScreenshotLayers(canvas, bitmap, response);
            File folder = new File(getCacheDir(), "screenshots");
            if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Cache directory unavailable");
            File image = File.createTempFile("PipePanic-", ".png", folder);
            try (FileOutputStream output = new FileOutputStream(image)) {
                if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) throw new IOException("PNG export failed");
            }
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".screenshots", image);
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType("image/png");
            share.putExtra(Intent.EXTRA_STREAM, uri);
            if (Build.VERSION.SDK_INT >= 16) share.setClipData(ClipData.newRawUri("PipePanic", uri));
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(share, uiResources.getString(R.string.share_screenshot)));
        } catch (IOException | JSONException | IllegalArgumentException | ActivityNotFoundException e) {
            Log.w("PipePanic", "Unable to share screenshot", e);
            Toast.makeText(this, uiResources.getString(R.string.share_failed), Toast.LENGTH_SHORT).show();
        } finally {
            if (bitmap != null) bitmap.recycle();
        }
    }

    private void configureDisplayInsets() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            displaySurface.setOnApplyWindowInsetsListener((surface, insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout());
                surface.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        } else if (Build.VERSION.SDK_INT >= 28) {
            displaySurface.setOnApplyWindowInsetsListener((surface, insets) -> {
                DisplayCutout cutout = insets.getDisplayCutout();
                boolean fullscreen = (getWindow().getAttributes().flags & LayoutParams.FLAG_FULLSCREEN) != 0;
                if (fullscreen && cutout != null) {
                    surface.setPadding(cutout.getSafeInsetLeft(), cutout.getSafeInsetTop(),
                            cutout.getSafeInsetRight(), cutout.getSafeInsetBottom());
                } else {
                    surface.setPadding(0, 0, 0, 0);
                }
                return insets;
            });
        }
    }

    public void applyFullScreen(View v) {
        boolean fullscreen = ((CheckBox) findViewById(R.id.fullscreen_checkbox)).isChecked();
        Window window = getWindow();
        if (fullscreen) window.addFlags(LayoutParams.FLAG_FULLSCREEN);
        else window.clearFlags(LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 28) {
            // Paint the window behind the camera area while keeping controls in the safe area.
            LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = fullscreen
                    ? LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                    : LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            window.setAttributes(attributes);
            if (Build.VERSION.SDK_INT < 30) {
                View decor = window.getDecorView();
                int visibility = decor.getSystemUiVisibility();
                decor.setSystemUiVisibility(fullscreen ? visibility | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        : visibility & ~View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
            }
            displaySurface.requestApplyInsets();
        }
    }

    public void resetHighscore(View v) {
        if (!pageReady) return;
        nativeModal = true;
        if (updates != null) updates.refresh();
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setMessage(uiResources.getString(R.string.clear_highscore_confirm))
                .setNegativeButton(uiResources.getString(R.string.cancel), null)
                .setPositiveButton(uiResources.getString(R.string.reset), (d, which) -> runGameScript("resetHighscore()"))
                .show();
        dialog.setOnDismissListener(d -> {
            nativeModal = false;
            if (updates != null) updates.refresh();
        });
        applyTypeface(dialog.getWindow().getDecorView());
    }

    public void newGame(View v) {
        if (!pageReady) return;
        hideHelp();
        runGameScript("ppreset(" + battlemodeseed.getProgress() + "," + (difficulty.getProgress() - 1) + ")");
        markGameStarted();
        drawerLayout.closeDrawer(GravityCompat.START);
        updatePauseState();
    }

    public void openLevels(View v) {
        if (!pageReady) return;
        hideHelp();
        runGameScript("levelMode.openPicker()");
        markGameStarted();
        drawerLayout.closeDrawer(GravityCompat.START);
        updatePauseState();
    }

    public void resumeGame(View v) {
        if (!hasPlayed) return;
        drawerLayout.closeDrawer(GravityCompat.START);
    }

    public void showHelp(View v) {
        if (!pageReady) return;
        helpActive = true;
        updatePauseState();
        runGameScript("help(1)");
        drawerLayout.closeDrawer(GravityCompat.START);
    }

    private void hideHelp() {
        if (helpActive) {
            helpActive = false;
            runGameScript("help(0)");
        }
    }
}
