# Fixed runtime dependency source

`sources/manifest.json` records the original authoritative download URL, exact byte count and SHA-256 for each vendored archive/POM. AndroidX source jars and POMs are from Google's Android Maven repository; EdDSA 0.3.0 is from Maven Central; the Three.js 0.187.0 npm archive matches the SHA-512 integrity in package-lock.json.

Unpack a `*-sources.jar` as ZIP to inspect the Java source. The Three.js tarball contains the full JS package source and its license. Gradle and npm remain pinned to the same release versions. Build tools, Android SDK/JDK and test-only dependencies are acquired through their original distributors and are not bundled as runtime source.

Licenses/attribution: AndroidX Apache-2.0; EdDSA CC0; Three.js MIT. Original headers and package metadata are retained. Full application notices live in `app/src/main/assets/jspp/third-party/` and are shipped in the APK. No private signing identities or website credentials are included.
