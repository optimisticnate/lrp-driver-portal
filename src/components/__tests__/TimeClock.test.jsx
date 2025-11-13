import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { dayjs } from "@/utils/time";

import TimeClock from "../TimeClock";

// Mock dependencies
vi.mock("@/context/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: {
      uid: "test-uid-123",
      email: "test@example.com",
      displayName: "Test User",
    },
    roleLoading: false,
  }),
}));

vi.mock("@/components/feedback/SnackbarProvider.jsx", () => ({
  useSnack: () => ({
    show: vi.fn(),
  }),
}));

vi.mock("@/services/fs", () => ({
  logTime: vi.fn().mockResolvedValue({ id: "log-123" }),
  subscribeTimeLogs: vi.fn((config) => {
    if (config.onData) {
      config.onData([]);
    }
    return () => {};
  }),
  updateTimeLog: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/utils/haptics.js", () => ({
  vibrateOk: vi.fn(),
  vibrateWarn: vi.fn(),
}));

describe("TimeClock Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Live Timer Functionality", () => {
    it("displays 00:00:00 initially when no active session", () => {
      render(<TimeClock />);
      expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    });

    it("formats timer correctly for sessions under 1 hour", async () => {
      const { subscribeTimeLogs } = await import("@/services/fs");

      subscribeTimeLogs.mockImplementation((config) => {
        if (config.onData) {
          config.onData([
            {
              id: "active-1",
              startTs: dayjs().subtract(125, "seconds").toDate(),
              status: "open",
              mode: "RIDE",
              rideId: "RIDE-001",
            },
          ]);
        }
        return () => {};
      });

      render(<TimeClock />);

      await waitFor(() => {
        const timer = screen.getByRole("timer");
        expect(timer.textContent).toMatch(/00:02:0[45]/); // 125s = 2m 5s
      });
    });

    it("formats hours correctly for sessions > 1 hour", async () => {
      const { subscribeTimeLogs } = await import("@/services/fs");

      subscribeTimeLogs.mockImplementation((config) => {
        if (config.onData) {
          config.onData([
            {
              id: "active-2",
              startTs: dayjs().subtract(3665, "seconds").toDate(), // 1h 1m 5s
              status: "open",
              mode: "RIDE",
            },
          ]);
        }
        return () => {};
      });

      render(<TimeClock />);

      await waitFor(() => {
        const timer = screen.getByRole("timer");
        expect(timer.textContent).toMatch(/01:01:0[45]/);
      });
    });

    it("updates timer every second", async () => {
      const { subscribeTimeLogs } = await import("@/services/fs");

      subscribeTimeLogs.mockImplementation((config) => {
        if (config.onData) {
          config.onData([
            {
              id: "active-3",
              startTs: dayjs().subtract(10, "seconds").toDate(),
              status: "open",
              mode: "RIDE",
            },
          ]);
        }
        return () => {};
      });

      render(<TimeClock />);

      await waitFor(() => {
        expect(screen.getByRole("timer")).toBeInTheDocument();
      });

      const timer = screen.getByRole("timer");
      const initialTime = timer.textContent;

      // Wait 2 seconds
      await waitFor(
        () => {
          expect(timer.textContent).not.toBe(initialTime);
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Boolean Fields - isNonRideTask and isMultipleRides", () => {
    it("sends isNonRideTask=true when Non-Ride Task checked", async () => {
      const { logTime } = await import("@/services/fs");
      const user = userEvent.setup();

      render(<TimeClock />);

      const nonRideCheckbox = screen.getByLabelText("Non-ride task");
      await user.click(nonRideCheckbox);

      const startButton = screen.getByRole("button", { name: /start/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(logTime).toHaveBeenCalledWith(
          expect.objectContaining({
            isNonRideTask: true,
            isMultipleRides: false,
            mode: "N/A",
          }),
        );
      });
    });

    it("sends isMultipleRides=true when Multiple Rides checked", async () => {
      const { logTime } = await import("@/services/fs");
      const user = userEvent.setup();

      render(<TimeClock />);

      const multiRideCheckbox = screen.getByLabelText("Multiple rides");
      await user.click(multiRideCheckbox);

      const startButton = screen.getByRole("button", { name: /start/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(logTime).toHaveBeenCalledWith(
          expect.objectContaining({
            isNonRideTask: false,
            isMultipleRides: true,
            mode: "MULTI",
          }),
        );
      });
    });

    it("sends both booleans as false for regular ride", async () => {
      const { logTime } = await import("@/services/fs");
      const user = userEvent.setup();

      render(<TimeClock />);

      const rideIdInput = screen.getByLabelText(/ride id/i);
      await user.type(rideIdInput, "RIDE-123");

      const startButton = screen.getByRole("button", { name: /start/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(logTime).toHaveBeenCalledWith(
          expect.objectContaining({
            isNonRideTask: false,
            isMultipleRides: false,
            mode: "RIDE",
            rideId: "RIDE-123",
          }),
        );
      });
    });

    it("disables other checkbox when one is checked", async () => {
      const user = userEvent.setup();
      render(<TimeClock />);

      const nonRideCheckbox = screen.getByLabelText("Non-ride task");
      const multiRideCheckbox = screen.getByLabelText("Multiple rides");

      // Check non-ride task
      await user.click(nonRideCheckbox);
      expect(nonRideCheckbox).toBeChecked();
      expect(multiRideCheckbox).not.toBeChecked();

      // Try to check multiple rides
      await user.click(multiRideCheckbox);
      expect(multiRideCheckbox).toBeChecked();
      expect(nonRideCheckbox).not.toBeChecked(); // Should uncheck
    });
  });

  describe("Accessibility Features", () => {
    it("timer has proper ARIA attributes", async () => {
      const { subscribeTimeLogs } = await import("@/services/fs");

      subscribeTimeLogs.mockImplementation((config) => {
        if (config.onData) {
          config.onData([
            {
              id: "active-4",
              startTs: dayjs().subtract(10, "seconds").toDate(),
              status: "open",
              mode: "RIDE",
            },
          ]);
        }
        return () => {};
      });

      render(<TimeClock />);

      await waitFor(() => {
        const timer = screen.getByRole("timer");
        expect(timer).toHaveAttribute("aria-live", "polite");
        expect(timer).toHaveAttribute("aria-atomic", "true");
      });
    });

    it("checkboxes have ARIA labels", () => {
      render(<TimeClock />);

      expect(screen.getByLabelText("Non-ride task")).toBeInTheDocument();
      expect(screen.getByLabelText("Multiple rides")).toBeInTheDocument();
    });

    it("info buttons have ARIA labels", () => {
      render(<TimeClock />);

      expect(
        screen.getByLabelText("Non-ride task information"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Multiple rides information"),
      ).toBeInTheDocument();
    });

    it("touch targets are properly sized (40x40px minimum)", () => {
      render(<TimeClock />);

      const infoButtons = [
        screen.getByLabelText("Non-ride task information"),
        screen.getByLabelText("Multiple rides information"),
      ];

      infoButtons.forEach((button) => {
        const rect = button.getBoundingClientRect();
        // MUI IconButton size="small" provides 40x40px by default
        expect(rect.width).toBeGreaterThanOrEqual(40);
        expect(rect.height).toBeGreaterThanOrEqual(40);
      });
    });
  });

  describe("Session Management", () => {
    it("disables Start button when session is active", async () => {
      const { subscribeTimeLogs } = await import("@/services/fs");

      subscribeTimeLogs.mockImplementation((config) => {
        if (config.onData) {
          config.onData([
            {
              id: "active-5",
              startTs: dayjs().subtract(100, "seconds").toDate(),
              status: "open",
              mode: "RIDE",
            },
          ]);
        }
        return () => {};
      });

      render(<TimeClock />);

      await waitFor(() => {
        const startButton = screen.getByRole("button", { name: /start/i });
        expect(startButton).toBeDisabled();
      });
    });

    it("enables Stop button when session is active", async () => {
      const { subscribeTimeLogs } = await import("@/services/fs");

      subscribeTimeLogs.mockImplementation((config) => {
        if (config.onData) {
          config.onData([
            {
              id: "active-6",
              startTs: dayjs().subtract(100, "seconds").toDate(),
              status: "open",
              mode: "RIDE",
            },
          ]);
        }
        return () => {};
      });

      render(<TimeClock />);

      await waitFor(() => {
        const stopButton = screen.getByRole("button", { name: /stop/i });
        expect(stopButton).not.toBeDisabled();
      });
    });

    it("disables checkboxes when session is active", async () => {
      const { subscribeTimeLogs } = await import("@/services/fs");

      subscribeTimeLogs.mockImplementation((config) => {
        if (config.onData) {
          config.onData([
            {
              id: "active-7",
              startTs: dayjs().subtract(100, "seconds").toDate(),
              status: "open",
              mode: "RIDE",
            },
          ]);
        }
        return () => {};
      });

      render(<TimeClock />);

      await waitFor(() => {
        expect(screen.getByLabelText("Non-ride task")).toBeDisabled();
        expect(screen.getByLabelText("Multiple rides")).toBeDisabled();
      });
    });
  });

  describe("Active Session Animation", () => {
    it("applies glow animation when session is active", async () => {
      const { subscribeTimeLogs } = await import("@/services/fs");

      subscribeTimeLogs.mockImplementation((config) => {
        if (config.onData) {
          config.onData([
            {
              id: "active-8",
              startTs: dayjs().subtract(50, "seconds").toDate(),
              status: "open",
              mode: "RIDE",
            },
          ]);
        }
        return () => {};
      });

      render(<TimeClock />);

      await waitFor(() => {
        // The active session box should have the animated glow
        const activeSessionBox = screen
          .getByText("Active Session")
          .closest("div");
        const styles = window.getComputedStyle(activeSessionBox.parentElement);

        // Check for animation property
        expect(styles.animation).toBeTruthy();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles negative time gracefully", async () => {
      const { subscribeTimeLogs } = await import("@/services/fs");

      subscribeTimeLogs.mockImplementation((config) => {
        if (config.onData) {
          config.onData([
            {
              id: "future",
              startTs: dayjs().add(10, "seconds").toDate(), // Future time
              status: "open",
              mode: "RIDE",
            },
          ]);
        }
        return () => {};
      });

      render(<TimeClock />);

      await waitFor(() => {
        const timer = screen.getByRole("timer");
        expect(timer.textContent).toBe("00:00:00");
      });
    });

    it("requires Ride ID for regular rides", async () => {
      const { logTime } = await import("@/services/fs");
      const user = userEvent.setup();

      render(<TimeClock />);

      const startButton = screen.getByRole("button", { name: /start/i });
      await user.click(startButton);

      // Should not call logTime without ride ID
      expect(logTime).not.toHaveBeenCalled();
    });

    it("does not require Ride ID for non-ride tasks", async () => {
      const { logTime } = await import("@/services/fs");
      const user = userEvent.setup();

      render(<TimeClock />);

      const nonRideCheckbox = screen.getByLabelText("Non-ride task");
      await user.click(nonRideCheckbox);

      const startButton = screen.getByRole("button", { name: /start/i });
      await user.click(startButton);

      expect(logTime).toHaveBeenCalled();
    });
  });
});
