//Motoko doesn’t support outbound HTTP

import Time "mo:base/Time";
import Debug "mo:base/Debug";
import Array "mo:base/Array";

actor class ContentCanister() {

  // in-memory id counter (use Int for compatibility with your moc)
  var lastId: Int = 0;

  // simple in-memory array of posts
  var posts: [Post] = [];

  public type Post = {
    id: Int;
    author: Principal;
    prompt: Text;
    platform: Text;
    contentType: Text;
    tone: Text;
    generatedPointer: ?Text;
    generatedHash: ?Text;
    model: ?Text;
    generationParams: ?Text;
    createdAt: Int;
    generatedAt: ?Int;
    status: Text;
  };

  // Create a draft and return its id
  public shared(msg) func create_draft(prompt: Text, platform: Text, contentType: Text, tone: Text): async Int {
    let caller = msg.caller;

    // increment id (Int arithmetic)
    lastId := lastId + 1;

    // Time.now() returns Int on your toolchain
    let now: Int = Time.now();

    let p: Post = {
      id = lastId;
      author = caller;
      prompt = prompt;
      platform = platform;
      contentType = contentType;
      tone = tone;
      generatedPointer = null;
      generatedHash = null;
      model = null;
      generationParams = null;
      createdAt = now;
      generatedAt = null;
      status = "draft";
    };

    // append to the array (Array.append returns a new array)
    posts := Array.append(posts, [p]);

    return lastId;
  };

  // Save generated content metadata (called by worker / backend)
  public shared(msg) func save_generated(id: Int, generatedPointer: Text, generatedHash: Text, model: Text, generationParams: Text): async () {
    // find post by id (linear scan, matching get_post approach)
    var found : Bool = false;
    var updatedPosts: [Post] = [];
    for (pp in posts.vals()) {
      if (pp.id == id) {
        found := true;
        let updated : Post = {
          id = pp.id;
          author = pp.author;
          prompt = pp.prompt;
          platform = pp.platform;
          contentType = pp.contentType;
          tone = pp.tone;
          generatedPointer = ?generatedPointer;
          generatedHash = ?generatedHash;
          model = ?model;
          generationParams = ?generationParams;
          createdAt = pp.createdAt;
          generatedAt = ?Time.now();
          status = "generated";
        };
        updatedPosts := Array.append(updatedPosts, [updated]);
      } else {
        updatedPosts := Array.append(updatedPosts, [pp]);
      };
    };
    if (not found) {
      Debug.print("save_generated: post not found");
    };
    posts := updatedPosts;
    return ();
  };

//User prompt → ContentCanister → AI model (Gemma) → Shield Gemma safety check → 
   //if safe → return to frontend
   //if unsafe → block or regenerate

//UPDATED BACKEND
// Generate content using an external AI (stub for now)
public shared(msg) func generate_content(id: Int): async ?Text {
  // find the draft
  var draftOpt = await get_post(id);
  switch (draftOpt) {
    case null { return null };
    case (?draft) {
      // Here you would call out to your AI service (Gemma, OpenAI, etc.)
      // For now, simulate generation
      let raw = "Generated content for prompt: " # draft.prompt;

      // Apply a simple "output filter" (stub)
      let filtered = if (draft.tone == "professional") {
        "Professional: " # raw
      } else {
        raw
      };

      // Update metadata
      await save_generated(
        draft.id,
        "pointer://mock",   // replace with IPFS/S3 pointer
        "hash123",          // replace with real hash
        "gemma",            // model name
        "{ \"tone\": \"" # draft.tone # "\" }"
      );

      return ?filtered;
    };
  };
};


  // Get a post by id (linear scan using iterator over posts)
  public query func get_post(id: Int): async ?Post {
    for (pp in posts.vals()) {
      if (pp.id == id) return ?pp;
    };
    return null;
  };
};
