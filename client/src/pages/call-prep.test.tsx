import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CallPrep from "./call-prep";

(globalThis as any).React = React;

const setLocationMock = vi.fn();
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mutateMock = vi.fn();
const toastMock = vi.fn();

vi.mock("wouter", () => ({
  useRoute: () => [true, { id: "calendar_event123" }],
  useLocation: () => ["/call/calendar_event123", setLocationMock],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => mockUseQuery(options),
  useMutation: (options: any) => {
    mockUseMutation(options);
    return {
      mutate: mutateMock,
      isPending: false,
    };
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/queryClient", () => {
  const setQueryData = vi.fn();
  return {
    apiRequest: vi.fn(),
    queryClient: {
      setQueryData,
    },
  };
});

vi.mock("@/components/ui/navigation", () => ({
  default: () => <div data-testid="navigation" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/call-prep/executive-summary", () => ({
  default: () => <div data-testid="executive-summary" />,
}));

vi.mock("@/components/call-prep/crm-history", () => ({
  default: () => <div data-testid="crm-history" />,
}));

vi.mock("@/components/call-prep/competitive-landscape", () => ({
  default: () => <div data-testid="competitive-landscape" />,
}));

vi.mock("@/components/call-prep/key-stakeholders", () => ({
  default: () => <div data-testid="key-stakeholders" />,
}));

vi.mock("@/components/call-prep/recent-news", () => ({
  default: () => <div data-testid="recent-news" />,
}));

vi.mock("@/components/call-prep/suggested-opportunities", () => ({
  default: () => <div data-testid="suggested-opportunities" />,
}));

const calendarCallResponse = {
  call: {
    id: "call-123",
    title: "Calendar Meeting",
    scheduledAt: new Date("2024-05-01T12:00:00Z").toISOString(),
    status: "upcoming",
  },
  company: null,
  contacts: [],
  callPrep: null,
  source: "calendar" as const,
  calendarEvent: {
    id: "event-123",
    summary: "Calendar Meeting",
  },
};

describe("CallPrep calendar event flow", () => {
  beforeEach(() => {
    setLocationMock.mockReset();
    mutateMock.mockReset();
    mockUseMutation.mockReset();
    mockUseQuery.mockImplementation((options: any) => {
      const key = options.queryKey;
      if (Array.isArray(key) && key[0] === "calendar-event-call") {
        if (options.enabled === false) {
          return { data: undefined, isLoading: false, error: null };
        }
        return { data: calendarCallResponse, isLoading: false, error: null };
      }

      if (Array.isArray(key) && key[0] === "/api/calls") {
        if (!options.enabled) {
          return { data: undefined, isLoading: false, error: null };
        }
        return { data: calendarCallResponse, isLoading: false, error: null };
      }

      return { data: undefined, isLoading: false, error: null };
    });
  });

  it("shows the generate prep button after resolving a calendar-sourced call", () => {
    const markup = renderToStaticMarkup(<CallPrep />);

    expect(markup).toContain('data-testid="button-generate-prep"');
  });
});
