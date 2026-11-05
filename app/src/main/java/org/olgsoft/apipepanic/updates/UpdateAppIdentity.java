package org.olgsoft.apipepanic.updates;

import org.olgsoft.apipepanic.BuildConfig;

/** QA and stable use the real installed package and separate server/state channels. */
public final class UpdateAppIdentity {
    public static final String APPLICATION_ID = "org.olgsoft.apipepanic.haoke";
    private UpdateAppIdentity() { }
    public static String channel(String applicationId) {
        return channel(applicationId, BuildConfig.DEBUG);
    }
    static String channel(String applicationId, boolean debug) {
        if (APPLICATION_ID.equals(applicationId) && !debug) return "stable";
        if ("org.olgsoft.apipepanic.haoke.qa".equals(applicationId) && debug) return "qa";
        return null;
    }
}
