import { useEffect, useRef, useState } from "react";
import { Upload, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  value: string;
  onFile: (file: File) => void;
  onRemove: () => void;
  businessName?: string;
  variant?: "logo" | "favicon";
}

export function LogoUpload({
  value,
  onFile,
  onRemove,
  businessName,
  variant = "logo",
}: LogoUploadProps) {
  const isFavicon = variant === "favicon";
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
  }, [value]);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, or SVG).");
      return;
    }
    onFile(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {value && !previewError ? (
        <div className="flex items-center gap-3 border border-border bg-background p-2 pr-2.5">
          <div
            className={cn(
              "flex items-center justify-center bg-muted/40 border border-border flex-shrink-0",
              isFavicon ? "h-10 w-10" : "h-10 w-16",
            )}
          >
            <img
              src={value}
              alt={isFavicon ? "Favicon preview" : "Logo preview"}
              className="object-contain max-h-full max-w-full p-1"
              onError={() => setPreviewError(true)}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {isFavicon ? "Favicon" : "Logo"} in use
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {businessName || "PNG, SVG, or JPEG"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium border border-border hover:bg-muted/50 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 border border-dashed transition-colors text-left",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/40",
            previewError && "border-destructive/40",
          )}
        >
          {previewError ? (
            <>
              <AlertCircle className="h-5 w-5 text-destructive/70 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-destructive truncate">Could not load image</p>
                <p className="text-xs text-muted-foreground">Click to upload a new one</p>
              </div>
            </>
          ) : (
            <>
              <div className="h-8 w-8 flex items-center justify-center bg-background border border-border flex-shrink-0">
                <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  Drop {isFavicon ? "a favicon" : "your logo"}, or{" "}
                  <span className="text-primary">browse</span>
                </p>
                <p className="text-xs text-muted-foreground">PNG, SVG, or JPEG</p>
              </div>
            </>
          )}
        </button>
      )}
    </>
  );
}
