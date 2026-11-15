import { mailDeliveryFor } from "@/modules/mails/infrastructure/providers/mail-driver";

describe("mailDeliveryFor", () => {
  it("sends for real only in production with Brevo", () => {
    expect(
      mailDeliveryFor({
        nodeEnv: "production",
        driver: "brevo",
        redirectTo: undefined,
      }),
    ).toBe("send");
  });

  it("never writes to real people outside production", () => {
    for (const nodeEnv of ["development", "test", undefined]) {
      expect(
        mailDeliveryFor({ nodeEnv, driver: "brevo", redirectTo: undefined }),
      ).toBe("log");
      expect(
        mailDeliveryFor({ nodeEnv, driver: "brevo", redirectTo: "  " }),
      ).toBe("log");
    }
  });

  it("redirects to the developer's address when set", () => {
    expect(
      mailDeliveryFor({
        nodeEnv: "development",
        driver: "brevo",
        redirectTo: "dev@example.com",
      }),
    ).toBe("redirect");
  });

  it("keeps the log driver everywhere", () => {
    expect(
      mailDeliveryFor({
        nodeEnv: "production",
        driver: "log",
        redirectTo: "dev@example.com",
      }),
    ).toBe("log");
  });
});
