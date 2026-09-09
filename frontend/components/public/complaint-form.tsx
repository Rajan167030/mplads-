"use client";

import { AlertTriangle, Camera, CheckCircle2, Loader2, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApiError, submitComplaint, type ComplaintSubmitResult } from "@/lib/api";

export function ComplaintForm({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ComplaintSubmitResult | null>(null);

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("This browser doesn't support location capture — try a different device.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow location access in your browser to submit a verified complaint."
            : "Could not get your location. Move to an open area and try again."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords || !photoFile || description.trim().length < 10) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitComplaint({
        project_id: projectId,
        description: description.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
        photo: photoFile,
      });
      setResult(res);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not reach the backend API — try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 size={20} />
          <span className="text-sm font-bold">Complaint submitted</span>
        </div>
        <p className="mt-2 text-sm text-slate-600">{result.message}</p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your reference code</div>
          <div className="mt-1 break-all font-mono text-sm font-bold text-slate-900">{result.token}</div>
          <p className="mt-1 text-[11px] text-slate-500">
            Save this code — it&apos;s the only way to check your complaint&apos;s status later, and it doesn&apos;t identify
            you. Use it on the{" "}
            <Link href="/complaint/status" className="font-semibold text-dashboard-navy underline">
              status check page
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs text-slate-500">
        Reporting a concern about <span className="font-semibold text-slate-800">{projectName}</span>. This form is
        anonymous — nothing you submit identifies you. Your device&apos;s live location is used only to confirm
        you&apos;re actually near the project site (within 200m).
      </p>

      <div className="mt-4">
        <label className="text-xs font-bold text-slate-700">What&apos;s the issue?</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          minLength={10}
          maxLength={2000}
          rows={4}
          required
          placeholder="Describe what you observed — e.g. work stopped, poor quality materials, site looks abandoned…"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-dashboard-navy focus:outline-none"
        />
      </div>

      <div className="mt-4">
        <label className="text-xs font-bold text-slate-700">Photo of the site</label>
        <div className="mt-1 flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashboard-navy px-3 py-2 text-xs font-bold text-dashboard-navy hover:bg-dashboard-navy hover:text-white">
            <Camera size={15} />
            {photoFile ? "Change photo" : "Take / choose photo"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} required />
          </label>
          {photoPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreviewUrl} alt="Selected complaint evidence" className="h-14 w-14 rounded-lg object-cover" />
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="text-xs font-bold text-slate-700">Your location</label>
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={captureLocation}
            disabled={locating}
            className="flex items-center gap-2 rounded-lg border border-dashboard-navy px-3 py-2 text-xs font-bold text-dashboard-navy hover:bg-dashboard-navy hover:text-white disabled:opacity-60"
          >
            {locating ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
            {locating ? "Getting location…" : coords ? "Location captured" : "Capture my location"}
          </button>
          {coords && (
            <span className="text-[11px] text-slate-500">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          )}
        </div>
        {locationError && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-red-600">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {locationError}
          </p>
        )}
      </div>

      {submitError && <p className="mt-4 text-xs font-medium text-red-600">{submitError}</p>}

      <button
        type="submit"
        disabled={submitting || !coords || !photoFile || description.trim().length < 10}
        className="mt-5 w-full rounded-lg bg-dashboard-navy px-4 py-2.5 text-sm font-bold text-white transition hover:bg-dashboard-blue disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Complaint"}
      </button>
    </form>
  );
}
