# Engage – Real-time AI Agents for Smarter Classrooms
Engage is a multimodal agentic platform for realtime educational experiences. It aims to maximize learning outcomes with personalized student insights and empower educators with in-class assistance. (200 chars. max)

<img width="1358" alt="Screenshot 2025-02-16 at 8 29 14 AM" src="https://github.com/user-attachments/assets/d9511f89-8dc1-480c-a70d-214d3175cc98" />
<img width="1358" alt="Screenshot 2025-02-16 at 8 29 47 AM" src="https://github.com/user-attachments/assets/1e9eb3f9-84c2-4bff-a81d-b8c9d9719b35" />
<img width="1359" alt="Screenshot 2025-02-16 at 8 23 58 AM" src="https://github.com/user-attachments/assets/d2d903ad-caf6-435d-a503-e39dbdd2dc73" />
<img width="1358" alt="Screenshot 2025-02-16 at 8 30 01 AM" src="https://github.com/user-attachments/assets/82b3a03d-40e9-43fb-8cbb-97279079818b" />

## Inspiration
As teaching assistants for large courses, we understand the difficulty of addressing individual student needs in real time. With resource constraints and high student-to-faculty ratios, traditional classroom analytics tend to rely on surveys or assessments, failing to capture live student comprehension and causing a disconnect between teachers and their students.
Engage changes that. Unlike previous solutions, Engage leverages real-world physical interactions—body language, speech, and classroom behaviors—to create a proactive AI teaching assistant that provides instant insights into student engagement and understanding. Engage also enables teachers with powerful presentation features capable of evolving to meet student needs during lectures, using agentic AI to dynamically insert information and provide additional resources.

## What it does
Engage is powered by a real-time multimodal AI, analyzing video, audio, and text to assess student attentiveness, participation, and comprehension, both per-class and long term. It also offers live content generation features to assist teachers by instantly creating learning aids, allowing for evolving presentations which answer students’ questions with increased clarity.
From a live classroom feed, the system:
- Captures events—recording structured teacher actions (ideas, feedback) and student responses (questions, distractions, confusing points), generating logs that are mapped to specific lecture sections for detailed per-topic analysis.
- Offers live Q&A—following along with classroom interactions and capable of performing retrieval-augmented generation (RAG) queries to retrieve course-specific content. The topic is drawn directly from uploaded course materials, ensuring consistent nomenclature/terminology – a huge improvement over internet searches.
- Assesses engagement—detects attentiveness levels, off-topic discussions, and areas of confusion, allowing teachers to adjust their approach mid-lesson and gain insights which can be used to guide their teaching style long-term.

By offering a data-driven view of each student’s engagement with the class, Engage empowers teachers to refine lectures, assignments, and support systems to better serve students’ needs.

## How we built it
Engage is built on Google Gemini 2.0 Flash Experimental, optimized for low-latency streaming inference. Engage dynamically calls custom tools in response to observed classroom events (e.g., detecting confusion, tracking student participation). 
Engage’s RAG-based content generation agent uses InterSystems IRIS for its backend, serving as a vector search-enabled SQL database which stores course materials for easy semantic access. SBERT is used to calculate vector embeddings for course content.
The application itself is built using TypeScript, React.JS, and Node.JS, with Python used for some APIs.

## Challenges we ran into
One of the biggest challenges was ensuring that each tool for the agent served a distinct yet complementary role within the system. Engagement tracking, event logging, and Q&A assistance needed to operate independently yet cohesively, with each agent serving a specific, specialized purpose, yet being able to interact with other agents effectively. We tested extensively to tune our prompts and injected heuristic logic where possible to ensure consistent output in a variety of classroom situations. We expect that as language models continue to become more accurate and cheaper, Engage will be able to derive further utility from the models it is built on.

Another challenge laid in integrating the multiple technologies comprising our stack. Between multimodal models, vector databases, and agent tool calling, we found it difficult to properly link all components even with extensive planning between teammates, especially with time pressure of a 36-hour hackathon.

Most of our team was also inexperienced in web development, which made for a challenging but an overall enjoyable experience as we learned new technologies and frameworks while building our project.


## Accomplishments that we're proud of
We’re proud of building our intuitive user experience within the time constraints. We’ve never previously worked with multimodal language models, especially in an educational context, and it was exciting for us to explore this technology and apply it to an area that we believe benefits from additional data at the physical level. 

## What we learned
We learned a lot about orchestrating and planning agent tools effectively, as well as how to work with multimodal data. We also picked up skills in web development as two of our team members lacked prior experience, and combining the various elements of the project involved significant debugging and integration skills which we are sure will be useful for future projects.

## What's next for Engage
We feel confident that real-time AI-powered classrooms will soon become the norm. We hope to integrate Engage with existing LMS systems, seamlessly linking content that students see in the classroom with online sources. We’re also interested in incorporating wearable data into our system, adding metrics like heart rate, fatigue, and readiness to better understand student well-being in the context of education. By aligning real-time data streams, proactive assistance, and personalized analytics, we’re excited to contribute to building the classroom of the future.


## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.
