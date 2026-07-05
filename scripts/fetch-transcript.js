import { fetchTranscript } from "youtube-transcript";
import { writeFile } from "node:fs";
import path from "node:path";

fetchTranscript() // URL
  .then((transcript) => {
    console.log(transcript);

    const outPath = path.join("data", "transcripts", "transcript-[name].json");
    writeFile(
      outPath,
      JSON.stringify(transcript, null, 2),
      (err) => {
        if (err) throw err;
        console.log(`Transcript saved to ${outPath}`);
      }
    );
  })
  .catch(console.error);