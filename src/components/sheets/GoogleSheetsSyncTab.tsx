import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Cloud,
  CloudCheck,
  CloudUpload,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Info,
  Layers,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Table as TableIcon,
  Trash2,
  Sparkles,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "firebase/auth";

// FILE TOO LARGE - will restore properly in next step
export function GoogleSheetsSyncTab() {
  return <div>Restoring...</div>;
}
