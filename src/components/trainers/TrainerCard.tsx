"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, MapPin, CheckCircle } from "lucide-react";
import { cn, getInitials, getSpecializationLabel, getCategoryColor } from "@/lib/utils";
import type { TrainerWithProfile } from "@/types";

interface TrainerCardProps {
  trainer: TrainerWithProfile;
}

export default function TrainerCard({ trainer }: TrainerCardProps) {
  const tp = trainer.trainer_profile;

  return (
    <Link
      href={`/trainers/${trainer.id}`}
      className="card-hover group block overflow-hidden"
    >
      {/* Avatar */}
      <div className="relative aspect-square bg-dark-card overflow-hidden">
        {trainer.avatar_url ? (
          <Image
            src={trainer.avatar_url}
            alt={trainer.full_name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl font-bold text-white/[0.06]">
              {getInitials(trainer.full_name)}
            </span>
          </div>
        )}

        {/* Verified badge */}
        {tp.is_verified && (
          <div className="absolute top-3 right-3 bg-dark/60 backdrop-blur-sm rounded-full p-1">
            <CheckCircle className="h-4 w-4 text-lime" />
          </div>
        )}

        {/* Work type badge */}
        <div className="absolute bottom-3 left-3">
          <span className="badge-lime text-[10px] backdrop-blur-sm">
            {tp.work_type === "online"
              ? "Online"
              : tp.work_type === "offline"
              ? "Offline"
              : "Online & Offline"}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        {/* Name + Rating */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm truncate pr-2">
            {trainer.full_name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <Star className="h-3 w-3 text-lime fill-lime" />
            <span className="text-xs text-white/60">
              {tp.rating > 0 ? tp.rating.toFixed(1) : "Yangi"}
            </span>
          </div>
        </div>

        {/* Details */}
        <p className="text-xs text-white/40 mb-3">
          {tp.experience_years > 0 && `${tp.experience_years} yil tajriba`}
          {tp.experience_years > 0 && tp.total_students > 0 && " · "}
          {tp.total_students > 0 && `${tp.total_students} shogird`}
        </p>

        {/* Specializations */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tp.specializations.slice(0, 2).map((spec) => (
            <span
              key={spec}
              className={cn("badge text-[10px] px-2 py-0.5", getCategoryColor(spec))}
            >
              {getSpecializationLabel(spec)}
            </span>
          ))}
          {tp.specializations.length > 2 && (
            <span className="badge-neutral text-[10px] px-2 py-0.5">
              +{tp.specializations.length - 2}
            </span>
          )}
        </div>

        {/* City */}
        {tp.city && (
          <div className="flex items-center gap-1 text-white/30">
            <MapPin className="h-3 w-3" />
            <span className="text-xs">{tp.city}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
