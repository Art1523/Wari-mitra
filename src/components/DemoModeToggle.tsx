import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { demoService } from "@/services/demoService";
import { Button } from "@/components/ui/button";

export function DemoModeToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => setOn(demoService.isOn()), []);

  return (
    <Button
      size="sm"
      variant={on ? "default" : "outline"}
      className="rounded-full"
      onClick={() => {
        if (on) {
          demoService.disable();
          setOn(false);
          toast("Demo Mode off", { description: "Your prototype edits are kept." });
        } else {
          demoService.enable();
          setOn(true);
          toast.success("Demo Mode on", {
            description: "Demonstration data reloaded across all screens.",
          });
        }
      }}
    >
      <Sparkles className="size-4" />
      <span className="hidden sm:inline">{on ? "Demo Mode: On" : "Demo Mode"}</span>
    </Button>
  );
}
