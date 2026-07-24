"use client";
import { redirect } from "next/navigation";

export default function ProtectedIndexPage() {
  redirect("/kuyruk");
}
