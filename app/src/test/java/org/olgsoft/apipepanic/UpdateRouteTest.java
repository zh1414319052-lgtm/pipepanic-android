package org.olgsoft.apipepanic;
import org.junit.Test;
import static org.junit.Assert.*;

/** Protect actual game routes from asynchronous update results. */
public class UpdateRouteTest {
    @Test public void onlySettledMenuAutomaticallyChecks() {
        assertTrue(MainActivity.updateRouteEligible(true,true,true,false,true,false,false));
        assertFalse(MainActivity.updateRouteEligible(true,true,true,false,false,false,false));
        assertFalse(MainActivity.updateRouteEligible(true,true,true,false,false,true,false));
        assertFalse(MainActivity.updateRouteEligible(false,true,true,false,true,false,false));
        assertFalse(MainActivity.updateRouteEligible(true,false,true,false,true,false,false));
        assertFalse(MainActivity.updateRouteEligible(true,true,false,false,true,false,false));
        assertFalse(MainActivity.updateRouteEligible(true,true,true,true,true,false,false));
    }
    @Test public void manualIsLimitedToForegroundAboutPage() {
        assertTrue(MainActivity.updateRouteEligible(true,true,true,false,false,true,true));
        assertFalse(MainActivity.updateRouteEligible(true,true,true,false,false,false,true));
        assertFalse(MainActivity.updateRouteEligible(false,true,true,false,false,true,true));
        assertFalse(MainActivity.updateRouteEligible(true,true,true,true,false,true,true));
    }
}
