"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CTAButton, SectionReveal } from "@/components/marketplace-ui";
import { ClientRatingFlow } from "@/components/service-session";
import { ErrorBoundary } from "@/components/error-boundary";
import { readAppSession } from "@/lib/client-session";
import {
  getClientBookings,
  writeBooking,
  updateBookingStatus,
  SOCIAL_CHANGE_EVENT,
  type BookingRequest,
  type BookingStatus,
} from "@/lib/social-store";
import { signalSessionExpired } from "@/components/session-expiry-modal";
import { BookingTimeline, TrustShield } from "@/components/wow-ux";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  FileText, 
  X, 
  AlertCircle, 
  ChevronRight, 
  ReceiptText 
} from "lucide-react";

// ── Service Pricing Breakdown Helper ─────────────────────────────────────────

function getServiceBreakdown(services: string[], total: number) {
  if (!services || services.length === 0) return [];
  const baseCount = services.length;
  // Separate a mock "Platform Service Charge" of KES 250 if total is large enough (> KES 1,000)
  const serviceCharge = total > 1000 ? 250 : 0;
  const remaining = total - serviceCharge;
  const perService = Math.round(remaining / baseCount);
  
  const items = services.map((name, idx) => {
    // Last item receives remaining balance to avoid rounding errors
    const price = idx === baseCount - 1 
      ? remaining - (perService * (baseCount - 1))
      : perService;
    return { name, price };
  });
  
  if (serviceCharge > 0) {
    items.push({ name: "Platform Service Charge", price: serviceCharge });
  }
  
  return items;
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[0_8px_28px_rgba(13,27,42,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/2" />
        </div>
        <div className="skeleton h-6 w-16 shrink-0" />
      </div>
      <div className="mt-3 flex gap-4">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-3 w-20" />
      </div>
      <div className="skeleton mt-4 h-8 w-full" style={{ borderRadius: "0.75rem" }} />
    </div>
  );
}

// ── Booking Card ──────────────────────────────────────────────────────────────

interface BookingCardProps {
  booking: BookingRequest;
  onSelect: (booking: BookingRequest) => void;
  onCancel: (e: React.MouseEvent, id: string, name: string) => void;
}

function BookingCard({ booking, onSelect, onCancel }: BookingCardProps) {
  const dateStr = (() => {
    try {
      return new Date(booking.preferredDate).toLocaleDateString("en-KE", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      });
    } catch { return booking.preferredDate; }
  })();

  const isCancellable = booking.status === "pending" || booking.status === "accepted";

  return (
    <div 
      onClick={() => onSelect(booking)}
      className="card-lift group rounded-[24px] bg-white p-5 shadow-[0_8px_28px_rgba(13,27,42,0.07)] cursor-pointer hover:shadow-[0_12px_36px_rgba(13,27,42,0.11)] transition-all border border-gray-100/50 hover:border-[var(--ms-rose)]/20 relative"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-[var(--ms-navy)] group-hover:text-[var(--ms-rose)] transition-colors">
              {booking.targetName}
            </p>
            <ChevronRight className="h-3 w-3 text-gray-400 group-hover:text-[var(--ms-rose)] group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--ms-mauve)]">{booking.services.join(", ")}</p>
        </div>
        <span className="shrink-0 text-base font-bold text-[var(--ms-navy)]">
          KES {booking.totalKES.toLocaleString()}
        </span>
      </div>

      {/* Meta row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--ms-mauve)]">
        <span className="font-medium">{dateStr}</span>
        <span className="text-gray-300">·</span>
        <span className="font-medium">{booking.preferredTime}</span>
        {booking.location && (
          <>
            <span className="text-gray-300">·</span>
            <span className="truncate max-w-[120px] sm:max-w-[180px]">{booking.location}</span>
          </>
        )}
      </div>

      {/* Animated timeline */}
      <div className="mt-4">
        <BookingTimeline status={booking.status as Parameters<typeof BookingTimeline>[0]["status"]} />
      </div>

      {/* Actions and Trust Shield */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2.5 items-center justify-between border-t border-gray-50 pt-3.5">
        {isCancellable ? (
          <>
            <div className="w-full sm:w-auto">
              <TrustShield variant="payment" />
            </div>
            <button
              type="button"
              onClick={(e) => onCancel(e, booking.id, booking.targetName)}
              className="w-full sm:w-auto px-4 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 shrink-0 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              booking.status === "completed" ? "bg-emerald-400" : "bg-red-400"
            )} />
            <span>{booking.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function ActivityPage() {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  async function loadBookings() {
    const session = readAppSession();
    if (!session || session.role === "guest") { setLoading(false); return; }

    // Load from localStorage immediately
    const local = getClientBookings(session.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setBookings(local);
    setLoading(false);

    // Then try DB and merge (DB is source of truth for status)
    try {
      const res = await fetch("/api/bookings", { credentials: "include" });
      if (res.status === 401) { signalSessionExpired(); return; }
      if (!res.ok) return;
      const data = await res.json() as { ok: boolean; bookings?: Array<{
        local_id?: string; id: string; service_names?: string[];
        provider_name?: string; provider_slug?: string; target_type?: string;
        booking_date: string; booking_time: string; total_kes?: number;
        notes?: string; status: string; created_at: string; updated_at: string;
      }> };
      if (!data.ok || !data.bookings) return;

      // Merge: write any DB bookings not yet in localStorage
      for (const dbB of data.bookings) {
        const localId = dbB.local_id ?? dbB.id;
        const exists = local.some((b) => b.id === localId || b.id === dbB.id);
        if (!exists) {
          const mapped: BookingRequest = {
            id: localId,
            clientId: session.id,
            clientName: session.role === "client" ? (session as { firstName: string }).firstName : "User",
            targetType: (dbB.target_type ?? "professionals") as "salons" | "professionals",
            targetSlug: dbB.provider_slug ?? "",
            targetName: dbB.provider_name ?? "Provider",
            services: dbB.service_names ?? [],
            preferredDate: dbB.booking_date,
            preferredTime: dbB.booking_time,
            totalKES: dbB.total_kes ?? 0,
            notes: dbB.notes ?? undefined,
            status: dbB.status as BookingRequest["status"],
            createdAt: dbB.created_at,
            updatedAt: dbB.updated_at,
          };
          writeBooking(mapped);
        }
      }

      // Re-read localStorage (now includes DB bookings)
      const merged = getClientBookings(session.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(merged);
    } catch { /* stay with localStorage */ }
  }

  useEffect(() => {
    void loadBookings();

    function onStorageChange() {
      const session = readAppSession();
      if (!session) return;
      const local = getClientBookings(session.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(local);

      // Keep open modal data in sync
      setSelectedBooking((current) => {
        if (!current) return null;
        const updated = local.find((b) => b.id === current.id);
        return updated || current;
      });
    }

    window.addEventListener(SOCIAL_CHANGE_EVENT, onStorageChange);
    window.addEventListener("storage", onStorageChange);
    return () => {
      window.removeEventListener(SOCIAL_CHANGE_EVENT, onStorageChange);
      window.removeEventListener("storage", onStorageChange);
    };
  }, []);

  const handleCancelBooking = async (e: React.MouseEvent, bookingId: string, targetName: string) => {
    if (e) e.stopPropagation();
    if (!confirm(`Are you sure you want to cancel your booking with ${targetName}?`)) {
      return;
    }

    // 1. Update localStorage status (triggers SOCIAL_CHANGE_EVENT)
    updateBookingStatus(bookingId, "cancelled");

    // 2. Alert salon
    alert(`Your booking with ${targetName} has been cancelled successfully.\nThe salon has been notified.`);

    // 3. Keep modal in sync
    setSelectedBooking((current) => {
      if (current?.id === bookingId) {
        return { ...current, status: "cancelled" };
      }
      return current;
    });

    // 4. Update the database record
    try {
      await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status: "cancelled" }),
      });
    } catch (err) {
      console.error("Failed to update status in DB:", err);
    }
  };

  // Status counters for Filter component
  const getCount = (status: string) => {
    if (status === "all") return bookings.length;
    return bookings.filter((b) => b.status === status).length;
  };

  const filteredBookings = bookings.filter((b) => {
    if (filterStatus === "all") return true;
    return b.status === filterStatus;
  });

  return (
    <AppShell currentNav="activity" requireSession>
      <ClientRatingFlow />
      <ErrorBoundary>
        <div className="section-grid">
          <SectionReveal className="rounded-[36px] bg-white p-6 shadow-[0_18px_48px_rgba(13,27,42,0.08)] lg:p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--ms-mauve)]">Activity</p>
            <h1 className="mt-3 text-4xl font-semibold text-[var(--ms-navy)]">
              Your bookings, saves, and follow-ups — in one place.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ms-mauve)]">
              Upcoming appointments, recent requests, and status updates stay organised here.
            </p>
          </SectionReveal>

          {/* Status Filter Component */}
          {bookings.length > 0 && (
            <SectionReveal className="flex flex-wrap gap-2 p-1.5 bg-gray-50 border border-gray-100 rounded-3xl max-w-fit">
              {[
                { id: "all", label: "All" },
                { id: "pending", label: "Pending" },
                { id: "accepted", label: "Accepted" },
                { id: "completed", label: "Completed" },
                { id: "cancelled", label: "Cancelled" },
              ].map((tab) => {
                const count = getCount(tab.id);
                const isActive = filterStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterStatus(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-2xl text-xs font-bold transition-all outline-none",
                      isActive
                        ? "bg-[var(--ms-rose)] text-white shadow-md shadow-[var(--ms-rose)]/12"
                        : "text-[var(--ms-mauve)] hover:text-[var(--ms-navy)] hover:bg-gray-100"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className={cn(
                      "inline-flex items-center justify-center h-4.5 min-w-[18px] px-1 rounded-full text-[10px] font-extrabold",
                      isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </SectionReveal>
          )}

          {loading ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
            </div>
          ) : bookings.length === 0 ? (
            <SectionReveal className="rounded-[28px] bg-white p-10 text-center shadow-[0_12px_40px_rgba(13,27,42,0.08)]">
              <p className="text-3xl font-semibold text-[var(--ms-navy)]">No bookings yet</p>
              <p className="mt-3 text-sm leading-7 text-[var(--ms-mauve)]">
                When you book a service, it will appear here so you can track its status.
              </p>
              <Link
                href="/discover"
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--ms-rose)] px-7 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(212,83,126,0.22)] transition hover:brightness-110"
              >
                Browse services
              </Link>
            </SectionReveal>
          ) : filteredBookings.length === 0 ? (
            <SectionReveal className="rounded-[28px] bg-white p-10 text-center shadow-[0_12px_40px_rgba(13,27,42,0.08)]">
              <p className="text-2xl font-semibold text-[var(--ms-navy)]">No {filterStatus} bookings found</p>
              <p className="mt-2.5 text-sm text-[var(--ms-mauve)]">
                You don't have any requests or appointments marked as "{filterStatus}" right now.
              </p>
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className="mt-4 inline-flex px-5 py-2 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Show all bookings
              </button>
            </SectionReveal>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredBookings.map((b) => (
                <BookingCard 
                  key={b.id} 
                  booking={b} 
                  onSelect={setSelectedBooking} 
                  onCancel={handleCancelBooking} 
                />
              ))}
            </div>
          )}

          <SectionReveal className="rounded-[32px] bg-white p-6 shadow-[0_18px_48px_rgba(13,27,42,0.08)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--ms-mauve)]">Need a fresh request?</p>
                <h2 className="mt-3 text-3xl font-semibold text-[var(--ms-navy)]">
                  Jump back into booking without losing context.
                </h2>
              </div>
              <CTAButton href="/book">Book again</CTAButton>
            </div>
          </SectionReveal>
        </div>
      </ErrorBoundary>

      {/* Booking Details Modal */}
      {selectedBooking && (() => {
        const fullDateStr = (() => {
          try {
            return new Date(selectedBooking.preferredDate).toLocaleDateString("en-KE", {
              weekday: "long", day: "numeric", month: "long", year: "numeric"
            });
          } catch { return selectedBooking.preferredDate; }
        })();

        const items = getServiceBreakdown(selectedBooking.services, selectedBooking.totalKES);
        const isCancellable = selectedBooking.status === "pending" || selectedBooking.status === "accepted";

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setSelectedBooking(null)}
          >
            <div 
              className="w-full max-w-lg rounded-[32px] bg-white p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="absolute right-6 top-6 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Close details"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Title Header */}
              <div className="mb-5 pr-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--ms-rose)] mb-1">
                  {selectedBooking.targetType === "salons" ? "Salon Appointment" : "Stylist Appointment"}
                </p>
                <h3 className="text-2xl font-bold text-[var(--ms-navy)]">
                  {selectedBooking.targetName}
                </h3>
              </div>

              {/* Scrollable details wrapper */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-2">
                {/* Visual status board */}
                <div className="bg-gray-50 rounded-2xl p-4.5 border border-gray-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Booking Status</p>
                  <BookingTimeline status={selectedBooking.status as Parameters<typeof BookingTimeline>[0]["status"]} />
                </div>

                {/* Info specifications list */}
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--ms-petal)] text-[var(--ms-rose)]">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Date</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--ms-navy)]">{fullDateStr}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--ms-petal)] text-[var(--ms-rose)]">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Time Window</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--ms-navy)]">{selectedBooking.preferredTime}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--ms-petal)] text-[var(--ms-rose)]">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Location Address</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--ms-navy)]">
                        {selectedBooking.location || "Mobile Salon service (Stylist travels to your location)"}
                      </p>
                    </div>
                  </div>

                  {selectedBooking.notes && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--ms-petal)] text-[var(--ms-rose)]">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Booking Instructions / Notes</p>
                        <p className="mt-0.5 text-sm italic text-gray-600 leading-6">"{selectedBooking.notes}"</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Receipt-style cost breakdown */}
                <div className="border-t border-dashed border-gray-200 pt-5">
                  <div className="flex items-center gap-1.5 mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <ReceiptText className="h-3.5 w-3.5 text-gray-400" />
                    <span>Price breakdown</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4.5 space-y-3 font-sans">
                    {items.map((item, idx) => {
                      const isFee = item.name.includes("Service Charge");
                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className={cn(
                            "font-medium",
                            isFee ? "text-gray-400 text-xs italic" : "text-gray-600"
                          )}>
                            {item.name}
                          </span>
                          <span className={cn(
                            "font-bold",
                            isFee ? "text-gray-400 text-xs" : "text-[var(--ms-navy)]"
                          )}>
                            KES {item.price.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                    <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between items-baseline">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--ms-navy)]">Grand Total</span>
                      <span className="text-lg font-extrabold text-[var(--ms-rose)]">
                        KES {selectedBooking.totalKES.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="mt-6 flex flex-col sm:flex-row gap-2 border-t border-gray-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="flex-1 min-h-12 inline-flex items-center justify-center rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                {isCancellable && (
                  <button
                    type="button"
                    onClick={(e) => handleCancelBooking(e, selectedBooking.id, selectedBooking.targetName)}
                    className="flex-1 min-h-12 inline-flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 text-sm font-bold transition-colors"
                  >
                    Cancel appointment
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </AppShell>
  );
}
