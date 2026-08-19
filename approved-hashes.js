/* ============================================================================
   Approved members of the Shrine of Tung.

   Each entry below is an access hash "encrypted" with the world's worst cipher:
   XOR every character against the phrase "TUNG" (repeating) and base64 the
   result. It is symmetric, so the same routine encodes and decodes. index.html
   decodes this list at load time and unlocks the chat for any browser whose
   stored hash is in it.

   To approve someone:
     1. Grab their hash from the Discord application message.
     2. Open the site, and in the browser console run:  shrineEncodeHash("theirhash")
     3. Paste the returned string into the array below (keep the quotes + comma).
     4. Commit + redeploy. They reload the site and they are in.

   Example — the hash 3f9a1c8e2b7d4a06 encodes to "ZzN3JmU2diJmN3kjYDR+cQ==".
   ============================================================================ */
window.SHRINE_APPROVED = [
  // "ZzN3JmU2diJmN3kjYDR+cQ==",   <- one encoded hash per line
];
