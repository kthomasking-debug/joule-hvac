// e2e/helpers/test-setup.ts
// Shared setup for Playwright E2E tests

export async function bypassOnboarding(page: any) {
  await page.addInitScript(() => {
    // Terms acceptance
    localStorage.setItem("engineering_suite_terms_accepted", "true");
    localStorage.setItem("engineering_suite_terms_accepted_version", "1.0");

    // Onboarding completion
    localStorage.setItem("hasCompletedOnboarding", "true");
    localStorage.setItem("onboarded", "true");

    // Safety acknowledgments
    localStorage.setItem("chargingCalc_safetyAcknowledged", "true");
    localStorage.setItem("acknowledgedSafetyNotice", "true");

    // Default user settings to avoid incomplete data
    const defaultSettings = {
      capacity: 24,
      efficiency: 15,
      winterThermostat: 70,
      summerThermostat: 74,
      useDetailedAnnualEstimate: false,
      utilityCost: 0.1,
      gasCost: 1.2,
      primarySystem: "heatPump",
      afue: 0.95,
      squareFeet: 1500,
      insulationLevel: 0.65,
      homeShape: 0.9,
      ceilingHeight: 8,
      homeElevation: 0,
      energyMode: "heating",
      solarExposure: 1.0,
      coolingSystem: "heatPump",
      coolingCapacity: 36,
      hspf2: 9.0,
      useElectricAuxHeat: true,
      tons: 3,
      compressorPower: 6,
      seer2: 15,
    };
    localStorage.setItem("userSettings", JSON.stringify(defaultSettings));
  });
}

export async function acceptTermsIfPresent(page: any) {
  // Attempt to accept terms modal if it appears — tests may clear localStorage which triggers this
  try {
    // Wait for the overlay root (if present) then click checkbox and Accept button inside it
    const overlay = page.locator(".fixed.inset-0");
    if (await overlay.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Try a scoped checkbox first; otherwise click any checkbox on the page (best-effort)
      const scopedChk = overlay.locator('input[type="checkbox"]');
      if (await scopedChk.count()) {
        await scopedChk.first().click({ force: true });
      } else {
        const anyChk = page.locator('input[type="checkbox"]');
        if (await anyChk.count()) {
          await anyChk.first().click({ force: true });
        } else {
          // Try clicking label with acceptance text
          const acceptLabel = page.getByText(
            /I have read and understand|I acknowledge|I understand/i
          );
          if (
            await acceptLabel.isVisible({ timeout: 2000 }).catch(() => false)
          ) {
            await acceptLabel.first().click({ force: true });
          }
        }
      }
      // Attempt to click any Accept button on the page
      const acceptBtn = page.getByRole("button", { name: /accept/i });
      if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await acceptBtn.first().click();
        await page
          .waitForSelector(".fixed.inset-0", { state: "hidden", timeout: 8000 })
          .catch(() => {});
      }
    }
  } catch (e) {
    // no-op
  }
}

export async function setupTest(page: any, context?: any) {
  await bypassOnboarding(page);

  // Mock Web Bluetooth API if context is provided
  if (context) {
    await mockBluetoothAPI(context);
  }
}

export async function mockBluetoothAPI(context: any) {
  await context.addInitScript(() => {
    (window as any).navigator.bluetooth = {
      requestDevice: async (options: any) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              name: "Fieldpiece SMAN360",
              gatt: {
                connected: false,
                connect: async () => {
                  return {
                    getPrimaryService: async (uuid: string) => {
                      return {
                        uuid,
                        getCharacteristic: async (charUuid: string) => {
                          return {
                            uuid: charUuid,
                            properties: { notify: true },
                            startNotifications: async () => {},
                            addEventListener: (event: string, handler: any) => {
                              setTimeout(() => {
                                const buffer = new ArrayBuffer(8);
                                const view = new DataView(buffer);
                                view.setFloat32(0, 335.0, true);
                                view.setFloat32(4, 120.0, true);
                                handler({ target: { value: view } });
                              }, 500);
                            },
                          };
                        },
                        getCharacteristics: async () => {
                          return [
                            {
                              properties: { notify: true },
                              startNotifications: async () => {},
                              addEventListener: () => {},
                            },
                          ];
                        },
                      };
                    },
                  };
                },
                disconnect: () => {},
              },
              addEventListener: () => {},
            });
          }, 100);
        });
      },
    };
  });
}
