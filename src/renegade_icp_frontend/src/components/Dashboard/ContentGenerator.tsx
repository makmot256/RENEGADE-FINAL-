import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Copy, Save, Share, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
import { AuthClient } from "@dfinity/auth-client";
import { Actor, HttpAgent } from "@dfinity/agent";
// TODO: Generate declarations with `dfx generate`
// import { idlFactory as content_idl } from "../../../../declarations/content_canister";
import { Principal } from "@dfinity/principal";

// Temporary placeholder for content_idl until declarations are generated
const content_idl: any = { 
  service: () => ({
    create_draft: () => {},
    update_draft_content: () => {},
    update_draft_status: () => {},
  })
};

//--  const content_canister_id = import.meta.env.VITE_CANISTER_ID_CONTENT_CANISTER!;
//If the variable isn’t loaded, that ! forces it to crash.
// ✅ Replace the hardcoded canisterId import with environment variables
const contentCanisterEnv = import.meta.env.VITE_CANISTER_ID_CONTENT_CANISTER;
const content_canister_id = contentCanisterEnv ? Principal.fromText(contentCanisterEnv) : Principal.anonymous();
const backend_canister_id = import.meta.env.VITE_CANISTER_ID_RENEGADE_ICP_BACKEND 
  ? Principal.fromText(import.meta.env.VITE_CANISTER_ID_RENEGADE_ICP_BACKEND)
  : Principal.anonymous();
const frontend_canister_id = import.meta.env.VITE_CANISTER_ID_RENEGADE_ICP_FRONTEND
  ? Principal.fromText(import.meta.env.VITE_CANISTER_ID_RENEGADE_ICP_FRONTEND)
  : Principal.anonymous();

const platforms = [
  { value: "twitter", label: "X / Twitter" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
];

const contentTypes = [
  { value: "post", label: "Regular Post" },
  { value: "thread", label: "Thread" },
  { value: "caption", label: "Image Caption" },
  { value: "blog", label: "Blog Post" },
];

const ContentGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("twitter");
  const [contentType, setContentType] = useState("post");
  const [tone, setTone] = useState("professional");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);
  const { toast } = useToast();

  // helper: create an authenticated actor
  async function getBackendActor() {
    let agent;
    if (import.meta.env.VITE_DFX_NETWORK === "local") {
      agent = new HttpAgent({ host: "http://127.0.0.1:4943" });
      await agent.fetchRootKey();
    } else {
      const authClient = await AuthClient.create();
      const identity = authClient.getIdentity();
      agent = new HttpAgent({ identity });
    }

    return Actor.createActor(content_idl, {
      agent,
      canisterId: content_canister_id,
    });
  }


  // Called when user clicks Generate Content
  const handleGenerate = async () => {
    if (!prompt) {
      toast({ title: "Missing prompt", description: "Please provide a prompt", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratedContent("");

    try {
      // 1. Create draft in Motoko
      const backendActor = await getBackendActor();
      const rawId: any = await backendActor.create_draft(prompt, platform, contentType, tone);
      const idNumber = typeof rawId === "bigint" ? Number(rawId) : Number(rawId);
      setDraftId(idNumber);

      // 2. Call Node backend to generate + moderate
      const resp = await fetch(`${BACKEND_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platform, contentType, tone }),
      });

      if (!resp.ok) {
        throw new Error("Generation failed");
      }

      const data = await resp.json();
      setGeneratedContent(data.content);

      toast({ title: "Draft created", description: `Draft id: ${idNumber}` });
    } catch (err) {
      console.error(err);
      toast({ title: "Generation failed", description: "Failed to create draft or generate content", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // Called when user clicks "Save to Blockchain"
  // It will call canister.save_generated(draftId, pointer, hash, model, params)
  const handleSave = async () => {
    if (!generatedContent) {
      toast({ title: "Nothing to save", description: "Generate content first", variant: "destructive" });
      return;
    }

    try {
      const backend = await getBackendActor();
      if (!backend) return;

      // If we don't have a draftId, create one now (so we can update it)
      let idToUse = draftId;
      if (!idToUse) {
        const rawId: any = await backend.create_draft(prompt, platform, contentType, tone);
        idToUse = typeof rawId === "bigint" ? Number(rawId) : Number(rawId);
        setDraftId(idToUse);
      }

      // Upload generatedContent to your storage (IPFS/S3) here.
      // For this example we'll mock an IPFS pointer and a simple hash:
      const pointer = `ipfs://fakehash-${Date.now()}`;                    // <-- replace with real upload
      const hash = `sha256:${String(Math.random()).slice(2, 12)}`;       // <-- replace with real hash
      const model = "mock-model-1";
      const generationParams = JSON.stringify({ temperature: 0.7 });

      // Call canister to save generated metadata
      await backend.save_generated(idToUse, pointer, hash, model, generationParams);

      toast({ title: "Saved", description: `Generated content saved to draft ${idToUse}` });
      setGeneratedContent((prev) => prev + `\n\nSaved at: ${pointer}`);
    } catch (err) {
      console.error("save failed", err);
      toast({ title: "Save failed", description: "Could not save generated content", variant: "destructive" });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    toast({ title: "Copied to clipboard", description: "The generated content has been copied to your clipboard" });
  };

  const handleShare = () => {
    toast({ title: "Ready to share", description: "Content has been added to your publishing queue" });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="generate">Generate Content</TabsTrigger>
          <TabsTrigger value="history">Generation History</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <Card className="cyber-card">
            <CardContent className="pt-6">
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt">What would you like to create?</Label>
                  <Textarea
                    id="prompt"
                    placeholder="E.g., A post about new AI features in our product, focusing on user benefits"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[100px] bg-renegade-dark border-renegade-green/30 focus:border-renegade-green focus:ring-renegade-green/20"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger className="bg-renegade-dark border-renegade-green/30">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {platforms.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content-type">Content Type</Label>
                    <Select value={contentType} onValueChange={setContentType}>
                      <SelectTrigger className="bg-renegade-dark border-renegade-green/30">
                        <SelectValue placeholder="Select content type" />
                      </SelectTrigger>
                      <SelectContent>
                        {contentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tone">Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="bg-renegade-dark border-renegade-green/30">
                        <SelectValue placeholder="Select tone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="excited">Excited</SelectItem>
                        <SelectItem value="humorous">Humorous</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-renegade-green hover:bg-renegade-green/80 text-black font-medium"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" /> Generate Content
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {generatedContent && (
            <Card className="cyber-card">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Label>Generated Content</Label>
                  <div className="relative">
                    <Textarea
                      value={generatedContent}
                      onChange={(e) => setGeneratedContent(e.target.value)}
                      className="min-h-[180px] bg-renegade-dark border-renegade-green/30"
                      readOnly={false}
                    />
                    <div className="absolute top-2 right-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopy}
                        className="h-8 w-8 p-0 text-renegade-green hover:bg-renegade-green/10"
                      >
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Copy</span>
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="border-renegade-green/50 text-renegade-green hover:bg-renegade-green/10"
                      onClick={handleSave}
                    >
                      <Save className="mr-2 h-4 w-4" /> Save to Blockchain
                    </Button>
                    <Button
                      onClick={handleShare}
                      className="bg-accent hover:bg-accent/80 text-white"
                    >
                      <Share className="mr-2 h-4 w-4" /> Add to Publishing Queue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card className="cyber-card">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Your generated content history will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContentGenerator;



//                         <Copy className="h-4 w-4" />
//                         <span className="sr-only">Copy</span>
//                       </Button>
//                     </div>
//                   </div>
//                   <div className="flex flex-col sm:flex-row gap-2">
//                     <Button
//                       variant="outline"
//                       className="border-renegade-green/50 text-renegade-green hover:bg-renegade-green/10"
//                       onClick={handleSave}
//                     >
//                       <Save className="mr-2 h-4 w-4" /> Save to Blockchain
//                     </Button>
//                     <Button
//                       onClick={handleShare}
//                       className="bg-accent hover:bg-accent/80 text-white"
//                     >
//                       <Share className="mr-2 h-4 w-4" /> Add to Publishing Queue
//                     </Button>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           )}
//         </TabsContent>

//         <TabsContent value="history">
//           <Card className="cyber-card">
//             <CardContent className="pt-6">
//               <div className="text-center py-8">
//                 <p className="text-muted-foreground">Your generated content history will appear here</p>
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>
//       </Tabs>
//     </div>
//   );
// };

// export default ContentGenerator;




