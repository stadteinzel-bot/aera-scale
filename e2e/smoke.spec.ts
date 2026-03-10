import { test, expect } from '@playwright/test';

test.describe('AERA SCALE — Smoke Tests', () => {

    test('should load the login page', async ({ page }) => {
        await page.goto('/');
        // Should see AERA branding or login form
        await expect(page).toHaveTitle(/AERA|Scale/i);
        // Page should have loaded (no blank screen)
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('should display login form elements', async ({ page }) => {
        await page.goto('/');
        // Wait for the app to render
        await page.waitForTimeout(3000);
        // Should have some input or button visible
        const hasInteractive = await page.locator('input, button').count();
        expect(hasInteractive).toBeGreaterThan(0);
    });

    test('should have proper security headers', async ({ page }) => {
        const response = await page.goto('/');
        expect(response).not.toBeNull();
        const headers = response!.headers();
        // Verify critical security headers
        expect(headers['x-frame-options']).toBeTruthy();
        expect(headers['x-content-type-options']).toBeTruthy();
        expect(headers['strict-transport-security']).toBeTruthy();
    });

    test('should serve static assets with caching', async ({ page }) => {
        const response = await page.goto('/');
        expect(response).not.toBeNull();
        // The HTML should not be cached (for instant deployments)
        const cacheControl = response!.headers()['cache-control'];
        expect(cacheControl).toContain('no-cache');
    });

    test('should not expose sensitive configuration', async ({ page }) => {
        // Try to access common sensitive paths
        const sensitivePaths = ['/.env', '/.env.local', '/firebase.json', '/.git/config'];
        for (const path of sensitivePaths) {
            const response = await page.goto(path);
            // Should return 403 or redirect to index.html (SPA fallback)
            if (response) {
                expect([200, 403]).toContain(response.status());
                // If 200, it should be the SPA fallback (not the actual file)
                if (response.status() === 200) {
                    const contentType = response.headers()['content-type'] || '';
                    expect(contentType).toContain('text/html');
                }
            }
        }
    });

    test('should load without JavaScript errors on login page', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        await page.goto('/');
        await page.waitForTimeout(3000);
        // Filter out known harmless errors (e.g., Firebase init warnings)
        const criticalErrors = consoleErrors.filter(e =>
            !e.includes('Firebase') && !e.includes('analytics') && !e.includes('gtag')
        );
        expect(criticalErrors).toHaveLength(0);
    });
});
