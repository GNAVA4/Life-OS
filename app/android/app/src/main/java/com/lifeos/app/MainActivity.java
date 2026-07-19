package com.lifeos.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);   // мост к виджету «Задачи на сегодня» (session 023)
        super.onCreate(savedInstanceState);
    }
}
