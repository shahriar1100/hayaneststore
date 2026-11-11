"use client";

import {
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Heart,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  UserPlus,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { SavedProductsContent } from "@/components/saved/saved-products-content";
import { announceNotice } from "@/components/ui/coming-soon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { catalogProducts } from "@/data/catalog";
import { formatPrice } from "@/data/store";
import type { CatalogProduct } from "@/types/store";
import { changeUserPasswordAsync, logoutUser, updateUserProfile, useAuth } from "@/lib/auth";
import { getCourierTrackingUrl } from "@/lib/fulfillment";
import { syncCustomerOrders, useOrders, type Order } from "@/lib/orders";

const items = [
  { id: "profile", label: "My Account", icon: UserRound },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "payments", label: "Payment Methods", icon: CreditCard },
  { id: "settings", label: "Account Settings", icon: Settings },
  { id: "logout", label: "Logout", icon: LogOut },
];

const RATING_LABELS: Record<number, string> = {
  1: "Needs Improvement",
  2: "Fair Quality",
  3: "Good & Modest",
  4: "Very Good Quality",
  5: "Exceptional · Highly Recommended",
};

function getOrderStageIndex(status: string): number {
  const s = status?.toLowerCase() || "pending";
  if (s === "pending") return 0;
  if (s === "confirmed" || s === "processing") return 1;
  if (s === "shipped") return 2;
  if (s === "delivered") return 3;
  return -1; // Cancelled / Returned / Refunded
}

export function AccountContent({ catalog = catalogProducts }: { catalog?: CatalogProduct[] }) {
  const searchParams = useSearchParams();
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const { user } = useAuth();
  const { orders } = useOrders();
  const latestCustomer = orders[0]?.customer;
  const queryTab = searchParams.get("tab");
  const active = selectedTab ?? (queryTab && items.some((item) => item.id === queryTab) ? queryTab : "profile");

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editAddress, setEditAddress] = useState("");

  // Addresses Tab Edit State
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addrCityInput, setAddrCityInput] = useState("");
  const [addrStreetInput, setAddrStreetInput] = useState("");
  const [addrPhoneInput, setAddrPhoneInput] = useState("");

  // Payment Preferences State (persisted in localStorage)
  const [preferredPayment, setPreferredPayment] = useState<"cod" | "bkash" | "nagad">(() => {
    if (typeof window === "undefined") return "cod";
    try {
      const saved = localStorage.getItem("noor-preferred-payment");
      return saved === "bkash" || saved === "nagad" ? saved : "cod";
    } catch {
      return "cod";
    }
  });
  const [savedWalletNumber, setSavedWalletNumber] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("noor-saved-wallet-number") ?? "";
    } catch {
      return "";
    }
  });

  // Account Settings — Password Change & Notification Preferences State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [orderAlertsEnabled, setOrderAlertsEnabled] = useState(true);
  const [promoAlertsEnabled, setPromoAlertsEnabled] = useState(true);

  // Review Modal State
  const [reviewModalTarget, setReviewModalTarget] = useState<{
    orderId: string;
    productId: string;
    name: string;
  } | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAuthorName, setReviewAuthorName] = useState("");
  const [reviewAuthorPhone, setReviewAuthorPhone] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewStepNotice, setReviewStepNotice] = useState("");
  const [reviewedKeys, setReviewedKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("noor-reviewed-orders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Automatically sync orders and reviewed product locks with backend on mount, focus, and every 4 seconds
  useEffect(() => {
    let activeFlag = true;

    const runSync = async () => {
      const transitions = await syncCustomerOrders();
      if (!activeFlag) return;

      let savedKeys: string[] = [];
      try {
        const raw = localStorage.getItem("noor-reviewed-orders");
        savedKeys = raw ? JSON.parse(raw) : [];
      } catch {
        savedKeys = [];
      }

      // Sync server-side reviewed keys so any product already reviewed in backend is permanently locked
      try {
        const rawOrders = localStorage.getItem("noor-orders");
        const parsedOrders = rawOrders ? (JSON.parse(rawOrders) as Array<{ id: string }>) : [];
        const orderIds = parsedOrders.map((o) => o.id).filter(Boolean);
        if (orderIds.length > 0) {
          const revRes = await fetch(
            `/api/reviews?orderIds=${encodeURIComponent(orderIds.join(","))}`,
            { cache: "no-store" },
          );
          if (revRes.ok) {
            const revData = (await revRes.json()) as {
              ok?: boolean;
              reviewedKeys?: string[];
            };
            if (revData.ok && Array.isArray(revData.reviewedKeys)) {
              const merged = Array.from(new Set([...savedKeys, ...revData.reviewedKeys]));
              if (merged.length !== savedKeys.length) {
                savedKeys = merged;
                if (activeFlag) {
                  setReviewedKeys(merged);
                }
                try {
                  localStorage.setItem("noor-reviewed-orders", JSON.stringify(merged));
                } catch {
                  // ignore
                }
              }
            }
          }
        }
      } catch {
        // Offline or network error
      }

      if (!activeFlag || transitions.length === 0) return;

      for (const { order, previousStatus, previousPaymentStatus } of transitions) {
        const paymentJustConfirmed =
          previousPaymentStatus !== "Paid" && order.paymentStatus === "Paid";
        const orderJustConfirmed =
          previousStatus !== order.status &&
          (order.status === "Confirmed" || order.status === "Processing");

        if (paymentJustConfirmed && orderJustConfirmed) {
          announceNotice(
            "Payment Verified & Ready to Ship!",
            `Order ${order.id} payment has been verified and the order is confirmed (Ready to Ship).`,
          );
          continue;
        }
        if (paymentJustConfirmed) {
          announceNotice(
            "Payment Verified",
            `Your ${order.paymentMethod.toUpperCase()} payment for Order ${order.id} has been verified & marked Paid.`,
          );
        }
        if (orderJustConfirmed) {
          announceNotice(
            "Confirmed · Ready to Ship",
            `Order ${order.id} is confirmed and now Ready to Ship!`,
          );
        } else if (previousStatus !== order.status && order.status === "Shipped") {
          announceNotice(
            "Order Shipped!",
            `Order ${order.id} has been shipped and is on its way to you.`,
          );
        } else if (previousStatus !== order.status && order.status === "Delivered") {
          announceNotice(
            "Order Delivered!",
            `Order ${order.id} has been delivered! Please rate your product.`,
          );
          const firstUnreviewed = order.items.find(
            (item) => !savedKeys.includes(`${order.id}_${item.id}`),
          );
          if (firstUnreviewed) {
            setReviewModalTarget({
              orderId: order.id,
              productId: firstUnreviewed.id,
              name: firstUnreviewed.name,
            });
            setReviewRating(5);
            setHoverRating(0);
            setReviewTitle("");
            setReviewComment("");
            setReviewAuthorName(order.customer.name ?? "");
            setReviewAuthorPhone(order.customer.phone ?? "");
            setReviewError("");
            setReviewStepNotice("");
          }
        }
      }
    };

    void runSync();
    const interval = window.setInterval(() => {
      void runSync();
    }, 4000);
    const onFocus = () => {
      void runSync();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      activeFlag = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const displayName = user?.name ?? latestCustomer?.name ?? "Guest shopper";
  const displayPhone = user?.phone ?? latestCustomer?.phone;
  const displayEmail = user?.email ?? latestCustomer?.email;
  const displayAddress = user?.address ?? latestCustomer?.address;
  const displayCity = user?.city ?? latestCustomer?.city;

  const current = items.find((item) => item.id === active) ?? items[0];
  const Icon = current.icon;

  function startEditing() {
    if (!user) return;
    setEditName(user.name);
    setEditPhone(user.phone);
    setEditEmail(user.email ?? "");
    setEditCity(user.city ?? "Dhaka");
    setEditAddress(user.address ?? "");
    setIsEditing(true);
  }

  function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const updated = updateUserProfile({
      name: editName,
      phone: editPhone,
      email: editEmail,
      city: editCity,
      address: editAddress,
    });
    setIsEditing(false);
    if (updated) {
      announceNotice("Profile updated", "Your account details have been saved.");
    }
  }

  function openReviewModal(target: { orderId: string; productId: string; name: string }, noticeText = "") {
    // Never allow opening the modal on an already-reviewed product
    if (reviewedKeys.includes(`${target.orderId}_${target.productId}`)) {
      const targetOrder = orders.find((o) => o.id === target.orderId);
      const fallbackItem = targetOrder?.items.find(
        (item) => !reviewedKeys.includes(`${target.orderId}_${item.id}`),
      );
      if (!fallbackItem) {
        announceNotice(
          "Already Reviewed",
          "You have already reviewed all products in this order.",
        );
        return;
      }
      target = {
        orderId: target.orderId,
        productId: fallbackItem.id,
        name: fallbackItem.name,
      };
    }

    setReviewModalTarget(target);
    setReviewRating(5);
    setHoverRating(0);
    setReviewTitle("");
    setReviewComment("");
    setReviewAuthorName(user?.name ?? latestCustomer?.name ?? "");
    setReviewAuthorPhone(user?.phone ?? latestCustomer?.phone ?? "");
    setReviewError("");
    setReviewStepNotice(noticeText);
  }

  async function handleSubmitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewModalTarget) return;

    const currentKey = `${reviewModalTarget.orderId}_${reviewModalTarget.productId}`;
    if (reviewedKeys.includes(currentKey)) {
      setReviewError("এই প্রোডাক্টটির রিভিউ আপনি ইতিমধ্যে জমা দিয়েছেন।");
      return;
    }

    if (!reviewComment.trim()) {
      setReviewError("Please write a few words about your experience.");
      return;
    }
    if (!reviewAuthorName.trim()) {
      setReviewError("Please provide your name.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: reviewModalTarget.productId,
          orderId: reviewModalTarget.orderId,
          customerName: reviewAuthorName.trim(),
          customerPhone: reviewAuthorPhone.trim() || null,
          rating: reviewRating,
          title: reviewTitle.trim() || undefined,
          comment: reviewComment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.alreadyReviewed) {
          const lockedKeys = Array.from(new Set([...reviewedKeys, currentKey]));
          setReviewedKeys(lockedKeys);
          try {
            localStorage.setItem("noor-reviewed-orders", JSON.stringify(lockedKeys));
          } catch {
            // ignore
          }
          const targetOrder = orders.find((o) => o.id === reviewModalTarget.orderId);
          const nextItem = targetOrder?.items.find(
            (item) => !lockedKeys.includes(`${targetOrder.id}_${item.id}`),
          );
          if (nextItem && targetOrder) {
            setReviewModalTarget({
              orderId: targetOrder.id,
              productId: nextItem.id,
              name: nextItem.name,
            });
            setReviewTitle("");
            setReviewComment("");
            setReviewStepNotice(
              `এই প্রোডাক্টটির রিভিউ আগে দেওয়া হয়েছে। এখন পরবর্তী প্রোডাক্ট "${nextItem.name}"-এর রিভিউ দিন।`,
            );
            return;
          }
        }
        setReviewError(data.error || "Failed to submit review.");
        return;
      }

      // Mark this product as reviewed for this order
      const nextReviewed = Array.from(new Set([...reviewedKeys, currentKey]));
      setReviewedKeys(nextReviewed);
      try {
        localStorage.setItem("noor-reviewed-orders", JSON.stringify(nextReviewed));
      } catch {
        // ignore
      }

      const submittedProductName = reviewModalTarget.name;
      const targetOrder = orders.find((o) => o.id === reviewModalTarget.orderId);
      const nextUnreviewedItem = targetOrder?.items.find(
        (item) => !nextReviewed.includes(`${targetOrder.id}_${item.id}`),
      );

      if (nextUnreviewedItem && targetOrder) {
        // Automatically advance the modal to the next unreviewed product in this order
        setReviewModalTarget({
          orderId: targetOrder.id,
          productId: nextUnreviewedItem.id,
          name: nextUnreviewedItem.name,
        });
        setReviewRating(5);
        setHoverRating(0);
        setReviewTitle("");
        setReviewComment("");
        setReviewError("");
        setReviewStepNotice(
          `✓ Review saved for "${submittedProductName}"! Now rate the next product in your order: "${nextUnreviewedItem.name}".`,
        );
        announceNotice(
          `Review Saved (${submittedProductName})`,
          `Now you can rate the next item in Order ${targetOrder.id}: ${nextUnreviewedItem.name}.`,
        );
      } else {
        setReviewModalTarget(null);
        setReviewStepNotice("");
        announceNotice(
          "Review Submitted",
          "Thank you! Your feedback has been submitted to our moderation team and will appear on the product page shortly.",
        );
      }
    } catch {
      setReviewError("Network error. Please try again.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  function renderStatusBadge(status: string) {
    const s = status?.toLowerCase() || "pending";
    if (s === "pending") {
      return (
        <span className="account-order-status status-pending">
          <Clock size={12} aria-hidden="true" />
          Pending Verification
        </span>
      );
    }
    if (s === "confirmed" || s === "processing") {
      return (
        <span className="account-order-status status-confirmed">
          <Package size={12} aria-hidden="true" />
          Confirmed · Ready to Ship
        </span>
      );
    }
    if (s === "shipped") {
      return (
        <span className="account-order-status status-shipped">
          <Truck size={12} aria-hidden="true" />
          Order Shipped
        </span>
      );
    }
    if (s === "delivered") {
      return (
        <span className="account-order-status status-delivered">
          <CheckCircle2 size={12} aria-hidden="true" />
          Delivered ✓
        </span>
      );
    }
    if (s === "cancelled" || s === "returned" || s === "refunded") {
      return (
        <span className="account-order-status status-cancelled">
          <X size={12} aria-hidden="true" />
          {status}
        </span>
      );
    }
    return <span className="account-order-status">{status}</span>;
  }

  function renderPaymentMetaStrip(order: Order) {
    const methodLabel =
      order.paymentMethod === "cod"
        ? "Cash on Delivery"
        : `${order.paymentMethod.toUpperCase()} (Manual Send Money)`;
    const payStatus = order.paymentStatus ?? "Pending";
    const payPillClass =
      payStatus === "Paid"
        ? "is-paid"
        : payStatus === "Failed"
          ? "is-failed"
          : "is-pending";
    const payLabel =
      payStatus === "Paid"
        ? "Payment Paid · Verified ✓"
        : payStatus === "Failed"
          ? "Payment Verification Issue"
          : order.paymentMethod === "cod"
            ? "Pay on Delivery"
            : "Payment Pending Verification";

    return (
      <div className="account-order-payment-strip">
        <div className="account-order-payment-left">
          <span>
            <strong>Payment:</strong> {methodLabel}
          </span>
          {order.paymentPhone && (
            <span>
              <strong>Sender:</strong> {order.paymentPhone}
            </span>
          )}
          {order.paymentTrxId && (
            <span>
              <strong>TrxID:</strong>{" "}
              <code className="account-trx-code">{order.paymentTrxId}</code>
            </span>
          )}
        </div>
        <span className={`account-pay-pill ${payPillClass}`}>{payLabel}</span>
      </div>
    );
  }

  function renderOrderLifecycleBox(order: Order) {
    const stageIdx = getOrderStageIndex(order.status);
    const steps = [
      { key: "pending", label: "Pending", icon: Clock },
      { key: "confirmed", label: "Ready to Ship", icon: Package },
      { key: "shipped", label: "Shipped", icon: Truck },
      { key: "delivered", label: "Delivered", icon: CheckCircle2 },
    ] as const;

    const unreviewedItems =
      order.status === "Delivered"
        ? order.items.filter((item) => !reviewedKeys.includes(`${order.id}_${item.id}`))
        : [];
    const firstUnreviewedItem = unreviewedItems[0];
    const totalProductsCount = order.items.length;
    const reviewedProductsCount = totalProductsCount - unreviewedItems.length;

    return (
      <div className="account-order-lifecycle">
        {stageIdx >= 0 && (
          <div className="account-order-stepper" aria-label="Order progress">
            {steps.map((step, idx) => {
              const isPast = idx < stageIdx;
              const isCurrent = idx === stageIdx;
              const StepIcon = step.icon;
              return (
                <div
                  key={step.key}
                  data-stage={step.key}
                  data-state={isCurrent ? "current" : isPast ? "past" : "upcoming"}
                  className={`account-step-item stage-${step.key} ${
                    isCurrent ? "is-current" : isPast ? "is-past" : "is-upcoming"
                  } ${stageIdx === 3 && idx === 3 ? "is-final-delivered" : ""}`}
                >
                  <div className="account-step-dot" aria-hidden="true">
                    {isPast ? (
                      <Check size={11} />
                    ) : isCurrent ? (
                      <StepIcon size={11} />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className="account-step-label">{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {order.status === "Pending" && (
          <div className="account-stage-alert is-pending" role="status">
            <Clock size={18} aria-hidden="true" />
            <div>
              <strong>
                {order.paymentMethod !== "cod" && order.paymentStatus !== "Paid"
                  ? "Payment & Order Pending Verification (পেমেন্ট ও অর্ডার যাচাই চলছে)"
                  : "Order Pending Verification (অর্ডারটি পর্যালোচনায় আছে)"}
              </strong>
              <p>
                {order.paymentMethod !== "cod" && order.paymentStatus !== "Paid"
                  ? `আপনার ${order.paymentMethod.toUpperCase()} Send Money (${order.paymentTrxId ? `TrxID: ${order.paymentTrxId}` : "তথ্য"}) আমাদের টিম যাচাই করছে। যাচাই সম্পন্ন হলে পেমেন্ট স্ট্যাটাস 'Paid' ও অর্ডার স্ট্যাটাস 'Confirmed · Ready to Ship' হয়ে যাবে।`
                  : "আপনার অর্ডারটি গ্রহণ করা হয়েছে। আমাদের টিম অর্ডারটি কনফার্ম করলে এটি 'Ready to Ship' অবস্থায় যাবে।"}
              </p>
            </div>
          </div>
        )}

        {(order.status === "Confirmed" || order.status === "Processing") && (
          <div className="account-stage-alert is-confirmed" role="status">
            <Package size={18} aria-hidden="true" />
            <div>
              <strong>Confirmed · Ready to Ship (অর্ডারটি শিপিংয়ের জন্য প্রস্তুত)</strong>
              <p>
                আপনার অর্ডারটি কনফার্ম করা হয়েছে এবং এখন কুরিয়ার ডিসপ্যাচ ও শিপিংয়ের জন্য প্রস্তুত (Ready to Ship) রয়েছে। শিপ হওয়ার পর এখানে আপডেট পাবেন।
              </p>
            </div>
          </div>
        )}

        {order.status === "Shipped" && (() => {
          const singleTrackUrl =
            (order.shipments?.length ?? 0) <= 1
              ? getCourierTrackingUrl(
                  order.courierProvider,
                  order.courierTrackingCode,
                  order.courierConsignmentId,
                )
              : null;
          const courierName =
            order.courierProvider === "pathao"
              ? "Pathao Courier"
              : order.courierProvider === "steadfast"
                ? "Steadfast Courier"
                : null;
          return (
            <div className="account-stage-alert is-shipped" role="status">
              <Truck size={18} aria-hidden="true" />
              <div>
                <strong>🚚 Order Shipped! (আপনার অর্ডারটি শিপ করা হয়েছে)</strong>
                <p>
                  আপনার পার্সেলটি {courierName ? `${courierName}-এর মাধ্যমে ` : ""}কুরিয়ারে শিপ করা হয়েছে এবং আপনার ডেলিভারি ঠিকানার পথে রয়েছে।
                  {order.courierTrackingCode ? (
                    <>
                      {" "}Tracking: <code className="account-trx-code">{order.courierTrackingCode}</code>
                      {singleTrackUrl && (
                        <>
                          {" "}
                          <a
                            href={singleTrackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="account-track-link"
                          >
                            Track Parcel <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        </>
                      )}
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          );
        })()}

        {order.status === "Delivered" && (
          <div className="account-stage-alert is-delivered" role="status">
            <div className="account-stage-delivered-main">
              <Sparkles size={18} aria-hidden="true" />
              <div>
                <strong>🎉 Order Delivered! Rate your product (ডেলিভারি সম্পন্ন হয়েছে)</strong>
                <p>
                  {totalProductsCount > 1 ? (
                    unreviewedItems.length > 0 ? (
                      <>
                        এই অর্ডারে আপনার মোট <strong>{totalProductsCount}টি প্রোডাক্ট</strong> রয়েছে ({reviewedProductsCount}/{totalProductsCount}টি রিভিউ দেওয়া হয়েছে)। নিচে প্রতিটি প্রোডাক্টের জন্য আলাদা আলাদা রিভিউ ও স্টার রেটিং দিন।
                      </>
                    ) : (
                      <>
                        ধন্যবাদ! এই অর্ডারের সবগুলো ({totalProductsCount}টি) প্রোডাক্টের রিভিউ সফলভাবে জমা দেওয়া হয়েছে।
                      </>
                    )
                  ) : (
                    <>
                      আপনার অর্ডারটি সফলভাবে ডেলিভারি হয়েছে! আপনার নতুন হিজাবটি কেমন লেগেছে তা নিচে রিভিউ ও স্টার রেটিং দিয়ে জানান।
                    </>
                  )}
                </p>
              </div>
            </div>
            {firstUnreviewedItem ? (
              <button
                type="button"
                className="account-delivered-banner-btn"
                onClick={() =>
                  openReviewModal({
                    orderId: order.id,
                    productId: firstUnreviewedItem.id,
                    name: firstUnreviewedItem.name,
                  })
                }
              >
                <Star size={14} fill="currentColor" aria-hidden="true" />
                {totalProductsCount > 1
                  ? reviewedProductsCount > 0
                    ? `Rate Remaining (${unreviewedItems.length} left)`
                    : `Rate All Products (${totalProductsCount})`
                  : "Rate Your Product"}
              </button>
            ) : (
              <span className="account-reviewed-pill">
                ✓ All {totalProductsCount > 1 ? `${totalProductsCount} Products ` : ""}Reviewed
              </span>
            )}
          </div>
        )}

        {(() => {
          const orderShipments = order.shipments ?? [];
          const hasSplitParcels = orderShipments.length > 1;
          const hasParcelTracking =
            orderShipments.some(
              (s) => Boolean(s.trackingCode || s.consignmentId || s.courierTrackingMessage || s.courierRawStatus),
            ) || Boolean(order.courierTrackingCode || order.courierTrackingMessage);

          if (!hasSplitParcels && !hasParcelTracking) return null;

          const parcelList =
            orderShipments.length > 0
              ? orderShipments
              : [
                  {
                    id: "PKG-1",
                    label: "Parcel 1",
                    fulfillmentSource: "in-house" as const,
                    courierProvider: order.courierProvider,
                    consignmentId: order.courierConsignmentId,
                    trackingCode: order.courierTrackingCode,
                    codAmount: order.paymentStatus === "Paid" ? 0 : order.total,
                    items: order.items.map((it) => ({
                      id: it.id,
                      slug: it.slug,
                      name: it.name,
                      colour: it.colour,
                      quantity: it.quantity,
                      unitPrice: it.price,
                    })),
                    deliveryStatus: order.deliveryStatus ?? ("Pending Dispatch" as const),
                    courierRawStatus: order.courierRawStatus,
                    courierTrackingMessage: order.courierTrackingMessage,
                  },
                ];

          return (
            <div className="account-shipments-box" aria-label="Parcel tracking details">
              <div className="account-shipments-head">
                <strong>
                  <Package size={14} aria-hidden="true" />
                  {hasSplitParcels
                    ? `Split-Parcel Delivery (${parcelList.length} Packages)`
                    : "Live Courier Tracking"}
                </strong>
                {hasSplitParcels && (
                  <span className="account-parcel-note">One delivery charge · No extra shipping fee</span>
                )}
              </div>

              <div className="account-shipments-grid">
                {parcelList.map((pkg, idx) => {
                  const code = pkg.trackingCode || pkg.consignmentId || "";
                  const trackHref = code
                    ? getCourierTrackingUrl(pkg.courierProvider, pkg.trackingCode, pkg.consignmentId)
                    : null;
                  const courierLabel =
                    pkg.courierProvider === "pathao"
                      ? "Pathao"
                      : pkg.courierProvider === "manual"
                        ? "Courier"
                        : "Steadfast";
                  const statusToneClass =
                    pkg.deliveryStatus === "Delivered"
                      ? "is-delivered"
                      : pkg.deliveryStatus === "In Transit" || pkg.deliveryStatus === "Out for Delivery"
                        ? "is-shipped"
                        : pkg.deliveryStatus === "Returned" || pkg.deliveryStatus === "Cancelled"
                          ? "is-failed"
                          : "is-pending";
                  return (
                    <div key={pkg.id} className="account-parcel-card">
                      <div className="account-parcel-top">
                        <span className="account-parcel-title">
                          {parcelList.length > 1
                            ? `Parcel ${idx + 1} of ${parcelList.length}`
                            : "Shipment Parcel"}
                          {" · "}
                          {pkg.fulfillmentSource === "supplier"
                            ? "Partner Fulfillment Hub"
                            : "HayaNest Studio"}
                        </span>
                        <span className={`account-parcel-pill ${statusToneClass}`}>
                          {pkg.deliveryStatus}
                        </span>
                      </div>

                      {parcelList.length > 1 && pkg.items.length > 0 && (
                        <div className="account-parcel-items">
                          {pkg.items
                            .map((it) => `${it.quantity} × ${it.name}${it.colour ? ` (${it.colour})` : ""}`)
                            .join(" · ")}
                        </div>
                      )}

                      <div className="account-parcel-meta">
                        {code ? (
                          <span className="account-parcel-track-wrap">
                            <strong>{courierLabel}:</strong>{" "}
                            <code className="account-trx-code">{code}</code>
                            {trackHref && (
                              <a
                                href={trackHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="account-track-link"
                              >
                                Track <ExternalLink size={11} aria-hidden="true" />
                              </a>
                            )}
                          </span>
                        ) : (
                          <span>Awaiting courier dispatch</span>
                        )}
                        {hasSplitParcels && order.paymentStatus !== "Paid" && (
                          <span>COD on Parcel: <strong>{formatPrice(pkg.codAmount)}</strong></span>
                        )}
                      </div>

                      {(pkg.courierTrackingMessage || pkg.courierRawStatus) && (
                        <div className="account-parcel-message">
                          {pkg.courierTrackingMessage || `Courier status: ${pkg.courierRawStatus}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  function renderOrderItemsList(order: Order) {
    const isDelivered = order.status === "Delivered";
    return (
      <ul className="account-order-items">
        {order.items.map((item, idx) => {
          const isReviewed = reviewedKeys.includes(`${order.id}_${item.id}`);
          return (
            <li key={`${item.id || item.name}-${item.colour || ""}-${idx}`} className="account-order-item-row">
              <div className="account-order-item-info">
                <Link href={`/products/${item.slug || item.id}`}>
                  {item.quantity} × {item.name}
                  {item.colour ? ` (${item.colour})` : ""}
                </Link>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </div>

              {/* Review button ONLY appears when this order's status is strictly "Delivered" */}
              {isDelivered && (
                <div className="account-order-item-review-action">
                  {isReviewed ? (
                    <button
                      type="button"
                      className="account-reviewed-pill"
                      disabled
                      aria-disabled="true"
                      title="You have already submitted a review for this product"
                    >
                      ✓ Reviewed
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="account-review-trigger-btn"
                      onClick={() =>
                        openReviewModal({
                          orderId: order.id,
                          productId: item.id,
                          name: item.name,
                        })
                      }
                    >
                      <Star size={13} fill="currentColor" aria-hidden="true" />
                      Rate &amp; Review
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  function handleSaveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const updated = updateUserProfile({
      city: addrCityInput.trim() || "Dhaka",
      address: addrStreetInput.trim(),
      phone: addrPhoneInput.trim() || user.phone,
    });
    setIsEditingAddress(false);
    if (updated) {
      announceNotice("Address saved", "Your default delivery address has been updated.");
    }
  }

  function handleSavePaymentPreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      localStorage.setItem("noor-preferred-payment", preferredPayment);
      localStorage.setItem("noor-saved-wallet-number", savedWalletNumber.trim());
    } catch {
      // Ignore storage error
    }
    announceNotice("Payment preference saved", "Your preferred payment method has been saved.");
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    setPwSaving(true);
    try {
      const result = await changeUserPasswordAsync({
        currentPassword,
        newPassword,
      });
      if (!result.ok) {
        setPwError(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwSuccess("Your password has been securely updated.");
      announceNotice("Password updated", "Your account password was changed successfully.");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="account-layout">
      <aside className="account-sidebar">
        <div className="account-profile">
          <div className="account-avatar" aria-hidden="true">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{displayName}</strong>
            <span>{displayPhone ? displayPhone : "Sign in to manage your account"}</span>
          </div>
        </div>
        <nav aria-label="Account navigation">
          {items.map(({ id, label, icon: ItemIcon }) => (
            <button
              type="button"
              key={id}
              className={active === id ? "active" : ""}
              onClick={() => setSelectedTab(id)}
            >
              <ItemIcon />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="account-main">
        <header>
          <Icon />
          <div>
            <h1>{current.label}</h1>
            <p>{active === "profile" ? "Manage your account" : "Account information and preferences"}</p>
          </div>
        </header>

        {active === "wishlist" ? (
          <SavedProductsContent catalog={catalog} />
        ) : active === "orders" ? (
          orders.length > 0 ? (
            <div className="account-orders-list">
              {orders.map((order) => (
                <article key={order.id} className="account-order-card">
                  <div className="account-order-head">
                    <div>
                      <strong>Order {order.id}</strong>
                      <span>
                        {new Date(order.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {renderStatusBadge(order.status)}
                  </div>

                  {/* Step-by-step Order Status Tracker & Notification Banner */}
                  {renderOrderLifecycleBox(order)}
                  {renderPaymentMetaStrip(order)}

                  {renderOrderItemsList(order)}

                  <div className="account-order-foot">
                    <span>
                      Deliver to: {order.customer.address}, {order.customer.city}
                    </span>
                    <div>
                      {order.discountAmount && order.discountAmount > 0 ? (
                        <span className="account-order-discount-note">
                          Discount: -{formatPrice(order.discountAmount)}{" "}
                        </span>
                      ) : null}
                      <strong>Total: {formatPrice(order.total)}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="account-panel account-empty">
              <h2>No orders yet</h2>
              <p>You have not placed any orders yet. Explore our collection to place your first order.</p>
              <Link href="/shop" className="account-shop-link">
                Explore Collection
              </Link>
            </div>
          )
        ) : active === "addresses" ? (
          <div className="account-profile-stack">
            <div className="account-panel">
              <div>
                <h2>Default Delivery Address</h2>
                {displayAddress ? (
                  <>
                    <p>
                      <strong>{displayName}</strong> · {displayAddress}
                      {displayCity ? `, ${displayCity}` : ""}
                    </p>
                    {displayPhone && <p>Phone: {displayPhone}</p>}
                  </>
                ) : (
                  <p>
                    No delivery address saved yet.{" "}
                    {user
                      ? "Click 'Add / Edit Address' to save your shipping address for faster checkout."
                      : "Place an order or sign in to save your delivery address."}
                  </p>
                )}
              </div>
              {user ? (
                <button
                  type="button"
                  className="account-action-btn"
                  onClick={() => {
                    setAddrCityInput(user.city ?? "Dhaka");
                    setAddrStreetInput(user.address ?? "");
                    setAddrPhoneInput(user.phone ?? "");
                    setIsEditingAddress(true);
                  }}
                >
                  {displayAddress ? "Edit Address" : "Add Address"}
                </button>
              ) : (
                <Link href="/login" className="account-action-btn" style={{ textDecoration: "none" }}>
                  Sign In to Save
                </Link>
              )}
            </div>

            {isEditingAddress && user && (
              <form className="account-edit-form" onSubmit={handleSaveAddress}>
                <h3>Update Default Shipping Address</h3>
                <div className="account-edit-grid">
                  <label>
                    <span>City / District *</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dhaka"
                      value={addrCityInput}
                      onChange={(e) => setAddrCityInput(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Contact Phone *</span>
                    <input
                      type="tel"
                      required
                      placeholder="01XXXXXXXXX"
                      value={addrPhoneInput}
                      onChange={(e) => setAddrPhoneInput(e.target.value)}
                    />
                  </label>
                  <label className="account-edit-full">
                    <span>Street Address &amp; Area *</span>
                    <input
                      type="text"
                      required
                      placeholder="House, Road, Block, Area"
                      value={addrStreetInput}
                      onChange={(e) => setAddrStreetInput(e.target.value)}
                    />
                  </label>
                </div>
                <div className="account-auth-actions">
                  <button type="submit" className="account-shop-link" style={{ marginTop: 0 }}>
                    Save Address
                  </button>
                  <button
                    type="button"
                    className="account-action-btn"
                    onClick={() => setIsEditingAddress(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : active === "payments" ? (
          <div className="account-profile-stack">
            <form className="account-edit-form" onSubmit={handleSavePaymentPreferences}>
              <h3>Preferred Checkout Payment Method</h3>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
                Choose your default payment method for faster checkout across Bangladesh.
              </p>
              <div className="account-edit-grid">
                <label>
                  <span>Default Payment Option</span>
                  <select
                    value={preferredPayment}
                    onChange={(e) =>
                      setPreferredPayment(e.target.value as "cod" | "bkash" | "nagad")
                    }
                    style={{
                      width: "100%",
                      minHeight: 42,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                    }}
                  >
                    <option value="cod">Cash on Delivery (Pay on Arrival)</option>
                    <option value="bkash">bKash Mobile Wallet</option>
                    <option value="nagad">Nagad Mobile Wallet</option>
                  </select>
                </label>
                <label>
                  <span>Saved bKash / Nagad Number (Optional)</span>
                  <input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={savedWalletNumber}
                    onChange={(e) => setSavedWalletNumber(e.target.value)}
                  />
                </label>
              </div>
              <div className="account-auth-actions">
                <button type="submit" className="account-shop-link" style={{ marginTop: 0 }}>
                  <Wallet size={15} aria-hidden="true" style={{ marginRight: 6 }} />
                  Save Payment Preference
                </button>
              </div>
            </form>

            <div className="account-panel">
              <div>
                <h2>Supported Payment Channels</h2>
                <p>
                  <strong>Cash on Delivery:</strong> Available nationwide across all 64 districts in
                  Bangladesh.
                </p>
                <p>
                  <strong>bKash &amp; Nagad:</strong> Fast mobile wallet verification on checkout.
                </p>
              </div>
              <ShieldCheck size={24} style={{ color: "var(--brand)", flexShrink: 0 }} />
            </div>
          </div>
        ) : active === "settings" ? (
          <div className="account-profile-stack">
            <div className="account-panel">
              <div>
                <h2>Appearance &amp; Display Theme</h2>
                <p>Switch between Light mode and Dark mode across the HayaNest BD storefront.</p>
              </div>
              <ThemeToggle />
            </div>

            <div className="account-panel">
              <div>
                <h2>Order &amp; Restock Notifications</h2>
                <p>
                  Live order status alerts are{" "}
                  <strong>{orderAlertsEnabled ? "Enabled" : "Muted"}</strong> · Seasonal collection
                  updates are <strong>{promoAlertsEnabled ? "Enabled" : "Muted"}</strong>.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="account-action-btn"
                  onClick={() => {
                    setOrderAlertsEnabled((v) => !v);
                    announceNotice(
                      "Notification settings updated",
                      `Live order alerts ${!orderAlertsEnabled ? "enabled" : "muted"}.`,
                    );
                  }}
                >
                  {orderAlertsEnabled ? "Mute Order Alerts" : "Enable Order Alerts"}
                </button>
                <button
                  type="button"
                  className="account-action-btn"
                  onClick={() => setPromoAlertsEnabled((v) => !v)}
                >
                  {promoAlertsEnabled ? "Mute Promo Updates" : "Enable Promo Updates"}
                </button>
              </div>
            </div>

            {user ? (
              <form className="account-edit-form" onSubmit={handleChangePassword}>
                <h3>
                  <Lock size={15} style={{ display: "inline", marginRight: 6 }} />
                  Change Account Password
                </h3>
                <div className="account-edit-grid">
                  <label>
                    <span>Current Password *</span>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>New Password (min 4 characters) *</span>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </label>
                  <label className="account-edit-full">
                    <span>Confirm New Password *</span>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </label>
                </div>
                {pwError && (
                  <p className="account-review-error" role="alert" style={{ marginTop: 8 }}>
                    {pwError}
                  </p>
                )}
                {pwSuccess && (
                  <p style={{ color: "#15803d", fontSize: 13, fontWeight: 600, marginTop: 8 }}>
                    {pwSuccess}
                  </p>
                )}
                <div className="account-auth-actions">
                  <button
                    type="submit"
                    className="account-shop-link"
                    style={{ marginTop: 0 }}
                    disabled={pwSaving}
                  >
                    {pwSaving ? "Updating…" : "Update Password"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="account-auth-banner">
                <div>
                  <h3>Password &amp; Security</h3>
                  <p>Sign in to your HayaNest BD account to manage your password and security settings.</p>
                </div>
                <div className="account-auth-actions">
                  <Link href="/login" className="account-shop-link" style={{ marginTop: 0 }}>
                    Sign In
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : active === "profile" ? (
          <div className="account-profile-stack">
            <div className="account-panel">
              <div>
                <h2>{displayName}</h2>
                <p>
                  {displayPhone
                    ? `Phone: ${displayPhone}${displayEmail ? ` · Email: ${displayEmail}` : ""}`
                    : "There is no connected account or profile data yet. You can shop as a guest or sign in below."}
                </p>
                {displayAddress && (
                  <p>
                    Default Address: {displayAddress}
                    {displayCity ? `, ${displayCity}` : ""}
                  </p>
                )}
              </div>
              {user ? (
                <button type="button" className="account-action-btn" onClick={startEditing}>
                  Edit Profile
                </button>
              ) : (
                <button type="button" disabled>
                  Edit Profile
                </button>
              )}
            </div>

            {orders.length > 0 && (
              <div className="account-order-card">
                <div className="account-order-head">
                  <div>
                    <strong>Latest Order: {orders[0].id}</strong>
                    <span>
                      {new Date(orders[0].createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {renderStatusBadge(orders[0].status)}
                </div>
                {renderOrderLifecycleBox(orders[0])}
                {renderPaymentMetaStrip(orders[0])}
                {renderOrderItemsList(orders[0])}
                <div className="account-order-foot">
                  <span>Total: {formatPrice(orders[0].total)}</span>
                  <button
                    type="button"
                    className="account-action-btn"
                    onClick={() => setSelectedTab("orders")}
                  >
                    View All Orders ({orders.length})
                  </button>
                </div>
              </div>
            )}

            {isEditing && user && (
              <form className="account-edit-form" onSubmit={handleSaveProfile}>
                <h3>Update Profile Details</h3>
                <div className="account-edit-grid">
                  <label>
                    <span>Full Name *</span>
                    <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </label>
                  <label>
                    <span>Phone Number *</span>
                    <input type="tel" required value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  </label>
                  <label>
                    <span>Email Address</span>
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </label>
                  <label>
                    <span>City</span>
                    <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                  </label>
                  <label className="account-edit-full">
                    <span>Street Address</span>
                    <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                  </label>
                </div>
                <div className="account-auth-actions">
                  <button type="submit" className="account-shop-link" style={{ marginTop: 0 }}>
                    Save Changes
                  </button>
                  <button type="button" className="account-action-btn" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {!user && (
              <div className="account-auth-banner">
                <div>
                  <h3>Optional Account Access</h3>
                  <p>
                    Shopping at HayaNest BD never requires a login. If you want to save your delivery details across visits or
                    link your guest orders, sign in or create an account anytime.
                  </p>
                </div>
                <div className="account-auth-actions">
                  <Link href="/login" className="account-shop-link" style={{ marginTop: 0, gap: "7px" }}>
                    <LogIn size={15} aria-hidden="true" />
                    Sign In
                  </Link>
                  <Link href="/signup" className="account-secondary-link">
                    <UserPlus size={15} aria-hidden="true" />
                    Create Account
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="account-panel account-empty">
            <h2>{user ? `Signed in as ${user.name}` : "Logout"}</h2>
            <p>
              {user
                ? "Sign out of your account on this device. Your saved wishlist and orders on this browser will remain safe."
                : "You are currently browsing as a guest shopper. Sign in if you have an existing account."}
            </p>
            {user ? (
              <button
                type="button"
                className="account-shop-link"
                onClick={() => {
                  logoutUser();
                  setSelectedTab("profile");
                  announceNotice("Signed out", "You have signed out and can continue shopping as a guest.");
                }}
              >
                Sign Out Now
              </button>
            ) : (
              <div className="account-auth-actions" style={{ marginTop: "14px" }}>
                <Link href="/login" className="account-shop-link" style={{ marginTop: 0 }}>
                  Go to Sign In
                </Link>
                <Link href="/signup" className="account-secondary-link">
                  Create Account
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Rate & Review Modal for Delivered Products */}
      {reviewModalTarget && (() => {
        const modalOrder = orders.find((o) => o.id === reviewModalTarget.orderId);
        const modalOrderItems = modalOrder?.items ?? [];
        const modalUnreviewedOthers = modalOrderItems.filter(
          (item) =>
            item.id !== reviewModalTarget.productId &&
            !reviewedKeys.includes(`${reviewModalTarget.orderId}_${item.id}`),
        );
        const modalReviewedCount = modalOrderItems.filter((item) =>
          reviewedKeys.includes(`${reviewModalTarget.orderId}_${item.id}`),
        ).length;

        return (
          <div
            className="account-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setReviewModalTarget(null);
            }}
          >
            <div className="account-modal-card">
              <div className="account-modal-header">
                <div>
                  <h3 id="review-modal-title">Rate Your Product</h3>
                  <p className="account-modal-subtitle">
                    Order <strong>{reviewModalTarget.orderId}</strong> · Currently rating:{" "}
                    <strong>{reviewModalTarget.name}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="account-modal-close"
                  onClick={() => setReviewModalTarget(null)}
                  aria-label="Close review dialog"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {/* Multi-Product Switcher when the order has 2 or more items */}
              {modalOrderItems.length > 1 && (
                <div className="account-modal-product-switcher">
                  <div className="account-modal-switcher-head">
                    <span>
                      Products in this Order ({modalReviewedCount} of {modalOrderItems.length} reviewed)
                    </span>
                    <small>Select each product to write a separate review</small>
                  </div>
                  <div className="account-modal-switcher-list" role="tablist" aria-label="Order products to review">
                    {modalOrderItems.map((item, idx) => {
                      const itemReviewed = reviewedKeys.includes(`${reviewModalTarget.orderId}_${item.id}`);
                      const isActiveItem = item.id === reviewModalTarget.productId;
                      return (
                        <button
                          key={`${item.id || item.name}-${item.colour || ""}-${idx}`}
                          type="button"
                          role="tab"
                          disabled={itemReviewed}
                          aria-disabled={itemReviewed}
                          aria-selected={isActiveItem}
                          className={`account-modal-product-pill ${isActiveItem ? "is-active" : ""} ${itemReviewed ? "is-reviewed" : ""}`}
                          onClick={() => {
                            if (itemReviewed || item.id === reviewModalTarget.productId) return;
                            setReviewModalTarget({
                              orderId: reviewModalTarget.orderId,
                              productId: item.id,
                              name: item.name,
                            });
                            setReviewRating(5);
                            setHoverRating(0);
                            setReviewTitle("");
                            setReviewComment("");
                            setReviewError("");
                            setReviewStepNotice("");
                          }}
                        >
                          <span className="account-modal-pill-num">{idx + 1}.</span>
                          <span className="account-modal-pill-name">{item.name}</span>
                          <span className="account-modal-pill-status">
                            {itemReviewed ? "✓ Reviewed (Locked)" : isActiveItem ? "Rating Now" : "Pending"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {reviewStepNotice && (
                <div className="account-modal-step-notice" role="status">
                  {reviewStepNotice}
                </div>
              )}

              <form onSubmit={handleSubmitReview} className="account-review-form">
                {/* Interactive Star Rating */}
                <div className="account-review-stars-group">
                  <span className="account-review-label">
                    Your Rating for <strong>{reviewModalTarget.name}</strong> *
                  </span>
                  <div
                    className="account-review-stars-row"
                    role="radiogroup"
                    aria-label="Star Rating from 1 to 5"
                  >
                    {[1, 2, 3, 4, 5].map((star) => {
                      const activeRating = hoverRating || reviewRating;
                      const isFilled = star <= activeRating;
                      return (
                        <button
                          type="button"
                          key={star}
                          role="radio"
                          aria-checked={reviewRating === star}
                          aria-label={`${star} star${star > 1 ? "s" : ""}`}
                          className={`account-star-btn ${isFilled ? "filled" : ""}`}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setReviewRating(star)}
                        >
                          <Star size={24} fill={isFilled ? "currentColor" : "none"} />
                        </button>
                      );
                    })}
                    <span className="account-star-desc">
                      {RATING_LABELS[hoverRating || reviewRating]}
                    </span>
                  </div>
                </div>

                {/* Review Title */}
                <div className="account-field">
                  <label htmlFor="review-title">Review Headline (Optional)</label>
                  <input
                    id="review-title"
                    type="text"
                    placeholder="e.g. Luxurious fabric, gorgeous color!"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                  />
                </div>

                {/* Review Comment */}
                <div className="account-field">
                  <label htmlFor="review-comment">
                    Your Review for {reviewModalTarget.name} *
                  </label>
                  <textarea
                    id="review-comment"
                    required
                    rows={4}
                    placeholder="How was the drape, opacity, texture, and everyday wear? Tell us what you loved about this item..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                </div>

                {/* Reviewer Details */}
                <div className="account-review-split-fields">
                  <div className="account-field">
                    <label htmlFor="review-name">Your Name *</label>
                    <input
                      id="review-name"
                      type="text"
                      required
                      placeholder="Your Name"
                      value={reviewAuthorName}
                      onChange={(e) => setReviewAuthorName(e.target.value)}
                    />
                  </div>
                  <div className="account-field">
                    <label htmlFor="review-phone">Phone Number (Optional)</label>
                    <input
                      id="review-phone"
                      type="tel"
                      placeholder="01XXXXXXXXX"
                      value={reviewAuthorPhone}
                      onChange={(e) => setReviewAuthorPhone(e.target.value)}
                    />
                  </div>
                </div>

                {reviewError && (
                  <p className="account-review-error" role="alert">
                    {reviewError}
                  </p>
                )}

                <div className="account-modal-actions">
                  <button
                    type="button"
                    className="account-modal-cancel-btn"
                    onClick={() => setReviewModalTarget(null)}
                  >
                    {modalReviewedCount > 0 ? "Finish Later" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="account-modal-submit-btn"
                  >
                    {reviewSubmitting
                      ? "Submitting…"
                      : modalUnreviewedOthers.length > 0
                        ? `Submit & Rate Next (${modalUnreviewedOthers.length} left) →`
                        : "Submit Review"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
