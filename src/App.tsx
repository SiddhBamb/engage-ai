/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import "react-pdf/dist/esm/Page/TextLayer.css";

import React, { useEffect, useRef, useState } from "react";
import { LiveAPIProvider, useLiveAPIContext } from "./contexts/LiveAPIContext";
import cn from "classnames";
import Draggable from "react-draggable";
import { ExpandMore, ExpandLess } from "@mui/icons-material";

// Material UI components
import Container from "@mui/material/Container";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import Slider from "@mui/material/Slider";
import { VideocamOff } from "@mui/icons-material";
import { createTheme, ThemeProvider } from "@mui/material/styles";

// For Gemini API function declarations
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { ToolCall } from "./multimodal-live-types";
import ControlTray from "./components/control-tray/ControlTray";
import SidePanel from "./components/side-panel/SidePanel";
import { IconButton } from "@mui/material";

// If you use react-pdf, ensure that you have installed it and its peer dependencies.
// For simplicity, we assume here that the Document and Page components work as expected.
import { Document, Page } from "react-pdf";
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// -----------------------------------------------------------------------------
// Color Scheme / MUI Theme Setup using your colors:
// "231942", "5e548e", "9f86c0", "be95c4", "e0b1cb"
const theme = createTheme({
  palette: {
    primary: {
      main: "#231942",
    },
    secondary: {
      main: "#5e548e",
    },
    // Using one of the lighter colors for the background
    background: {
      default: "#e0b1cb",
    },
    info: {
      main: "#9f86c0",
    },
    warning: {
      main: "#be95c4",
    },
  },
});

// -----------------------------------------------------------------------------
// Data and Function Declarations (unchanged)
// -----------------------------------------------------------------------------

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
  throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
}
const host = "generativelanguage.googleapis.com";
const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

const lecture_sections = [
  {
    title: "Intro to Calculus",
    description:
      "This section covers the basics of calculus, including limits, derivatives, and integrals.",
  },
  {
    title: "Derivatives",
    description:
      "This section covers the basics of derivatives, including how to find the derivative of a function at a point.",
  },
  {
    title: "Applications of Derivatives",
    description:
      "This section covers the applications of derivatives, including optimization and related rates.",
  },
  {
    title: "Integration and the Fundamental Theorem of Calculus",
    description:
      "This section covers the basics of integrals, including how to find the integral of a function at a point.",
  },
  {
    title: "Applications of Integration",
    description:
      "This section covers the applications of integration, including area under a curve and volume of a solid.",
  },
];

// Represents a person tracked by the system.
interface Person {
  name: string;
  physical_description: string;
  role: "student" | "teacher";
}

// Represents a teaching event.
interface StudentEvent {
  name: string;
  description: string;
  type: "correction" | "misunderstanding" | "clarification" | "comment" | "distraction";
  section: string;
}
interface TeacherEvent {
  description: string;
  type: "idea" | "feedback";
  section: string;
}
interface Timestamped {
  timestamp: number;
}

interface TPerson extends Person, Timestamped {}
interface TStudentEvent extends StudentEvent, Timestamped {}
interface TTeacherEvent extends TeacherEvent, Timestamped {}

const searchContentForIdea: FunctionDeclaration = {
  name: "search_content_for_idea",
  description: "Search for content in the textbook that is relevant to the idea and display it to the user. Only allowed to use this when specifically instructed to do a Deep Dive into 'x' on the (internet | textbook).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      idea: {
        type: SchemaType.STRING,
        description: "The idea to search for.",
      },
      type: {
        type: SchemaType.STRING,
        description: "The type of content to search for.",
        // enum: ["textbook", "slides", "internet"],
        enum: ["textbook", "internet"],
      },
    },
    required: ["idea", "type"],
  },
};

// Function declarations
const trackNewPersonDeclaration: FunctionDeclaration = {
  name: "track_new_person",
  description:
    "Wait for someone to introduce themselves to you explicitly with 'I'm ...'. When they do, store their name and physical description as well as whether they are a student or teacher.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      person: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: "The name of the person.",
          },
          physical_description: {
            type: SchemaType.STRING,
            description: "Physical description of the person.",
          },
          role: {
            type: SchemaType.STRING,
            enum: ["student", "teacher"],
            description: "The role of the person.",
          },
        },
        required: ["name", "physical_description", "role"],
      },
    },
    required: ["person"],
  },
};

const recordTeacherEventDeclaration: FunctionDeclaration = {
  name: "record_teacher_event",
  description:
    "Records a teacher event. This can either be a standalone idea or concept that they explained, or feedback on their teaching style. For example, if the teacher explained a new concept or if they went too fast through a piece of material, you should note it!",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      event: {
        type: SchemaType.OBJECT,
        properties: {
          description: {
            type: SchemaType.STRING,
            description: "Description of the teacher event.",
          },
          type: {
            type: SchemaType.STRING,
            enum: ["idea", "feedback"],
            description: "Type of the teacher event.",
          },
          section: {
            type: SchemaType.STRING,
            enum: [...lecture_sections.map((s) => s.title), "Miscellaneous"],
            description:
              "The section of the lecture that the teacher event is in. This should be one of the following: " +
              lecture_sections.map((s) => `"${s.title}"`).join(", ") +
              ', "Miscellaneous"',
          },
        },
        required: ["description", "type", "section"],
      },
    },
    required: ["event"],
  },
};

const recordStudentEventDeclaration: FunctionDeclaration = {
  name: "record_student_event",
  description:
    "Records a student event for a person (you must have already been introduced to them). Call this function when you observe a student event. For example, if the student asks a question, looks confused, looks distracted, or seems like they are following along, note these things!",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      event: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: "The name of the person.",
          },
          description: {
            type: SchemaType.STRING,
            description: "A detailed description of the student event.",
          },
          type: {
            type: SchemaType.STRING,
            enum: ["correction", "misunderstanding", "clarification", "comment", "distraction"],
            description: "Type of the student event.",
          },
          section: {
            type: SchemaType.STRING,
            enum: [...lecture_sections.map((s) => s.title), "Miscellaneous"],
            description:
              "The section of the lecture that the student event is in. This should be one of the following: " +
              lecture_sections.map((s) => `"${s.title}"`).join(", ") +
              ', "Miscellaneous"',
          },
        },
        required: ["name", "description", "type", "section"],
      },
    },
    required: ["event"],
  },
};

// -----------------------------------------------------------------------------
// Viewer Components with the updated color scheme and slider navigation
// -----------------------------------------------------------------------------

interface ViewerProps {
  page: number;
  setPage: (page: number) => void;
}

function SlideViewer({ page, setPage }: ViewerProps) {
  // The SlideViewer loads the "Calculus I – Introduction to Limits.pdf" file.
  const file = process.env.PUBLIC_URL + "/Calculus I – Introduction to Limits.pdf";
  const [numPages, setNumPages] = useState<number | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const previousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const nextPage = () => {
    if (numPages && page < numPages) setPage(page + 1);
  };

  // Define the slide component so that the Document isn't reloaded on every page change.
  const SlideComponent = (
    <Box
      sx={{
        border: "2px solid #231942",
        p: 4,
        textAlign: "center",
        borderRadius: 1,
        // backgroundColor: "#be95c4",
        color: "#231942",
        mb: 2,
      }}
    >
      <div style={{ marginTop: "16px", marginBottom: "16px" }}>
        <p>
          Page {page || (numPages ? 1 : "--")} of {numPages || "--"}
        </p>
        <Button variant="contained" disabled={page <= 1} onClick={previousPage} sx={{ mr: 1 }}>
          Previous
        </Button>
        <Button variant="contained" disabled={numPages ? page >= numPages : true} onClick={nextPage}>
          Next
        </Button>
      </div>
      <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <Page pageNumber={page} width={window.innerWidth * 0.8} />
        </Box>
      </Document>
    </Box>
  );

  return SlideComponent;
}

function PDFViewer({ page, setPage }: ViewerProps) {
  // The PDFViewer loads the "Calculus I – Textbook.pdf" file.
  const file = process.env.PUBLIC_URL + "/Calculus I – Textbook.pdf";
  const [numPages, setNumPages] = useState<number | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const previousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const nextPage = () => {
    if (numPages && page < numPages) setPage(page + 1);
  };

  // Define your PDF component as a constant so that it is returned directly.
  // This helps ensure that the Document is not re-instantiated on every slider change.
  const PDFComponent = (
    <Box
      sx={{
        border: "2px solid #231942",
        p: 4,
        textAlign: "center",
        borderRadius: 1,
        // backgroundColor: "#be95c4",
        color: "#231942",
        mb: 2,
      }}
    >
      <div style={{ marginTop: "16px", marginBottom: "16px" }}>
        <p>
          Page {page || (numPages ? 1 : "--")} of {numPages || "--"}
        </p>
        <Button variant="contained" disabled={page <= 1} onClick={previousPage} sx={{ mr: 1 }}>
          Previous
        </Button>
        <Button variant="contained" disabled={numPages ? page >= numPages : true} onClick={nextPage}>
          Next
        </Button>
      </div>
      <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <Page pageNumber={page} width={window.innerWidth * 0.8} height={window.innerHeight * 0.8}/>
        </Box>
      </Document>
    </Box>
  );

  return PDFComponent;
}

function SearchViewer() {
  return (
    <Box
      sx={{
        border: "2px solid #9f86c0",
        p: 4,
        textAlign: "center",
        borderRadius: 1,
        backgroundColor: "#e0b1cb",
        color: "#231942",
      }}
    >
      <Typography variant="h6">Search Viewer Placeholder</Typography>
    </Box>
  );
}

function ReportView() {
  return (
    <Box
      sx={{
        border: "2px solid #d32f2f",
        p: 4,
        textAlign: "center",
        borderRadius: 1,
        backgroundColor: "#be95c4",
        color: "#231942",
      }}
    >
      <Typography variant="h6">Report View Placeholder</Typography>
    </Box>
  );
}

function Logger() {
  return (
    <Box
      sx={{
        border: "2px solid #7b1fa2",
        p: 4,
        textAlign: "center",
        borderRadius: 1,
        height: "100%",
        backgroundColor: "#e0b1cb",
        color: "#231942",
      }}
    >
      <Typography variant="h6">Logger Placeholder</Typography>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Main App Component wrapping everything in the custom theme
// -----------------------------------------------------------------------------
function App() {
  return (
    <ThemeProvider theme={theme}>
      <div className="App">
        <LiveAPIProvider url={uri} apiKey={API_KEY}>
          <AgentOrchestrator />
        </LiveAPIProvider>
      </div>
    </ThemeProvider>
  );
}

// -----------------------------------------------------------------------------
// Agent Orchestrator Component (Main App Content)
// -----------------------------------------------------------------------------
function AgentOrchestrator() {
  // Reference for the video element (if used)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [viewMode, setViewMode] = useState<"presenter" | "backend">("presenter");
  const [presentationStatus, setPresentationStatus] = useState<
    "stopped" | "in-progress" | "paused"
  >("stopped");
  const [presenterMode, setPresenterMode] = useState<"slide" | "pdf" | "search">("slide");

  // NEW STATES: current page tracking for the slide PDF and the textbook PDF
  const [slidePage, setSlidePage] = useState(1);
  const [pdfPage, setPdfPage] = useState(3);

  // Agent state (tracked data)
  const [trackedPeople, setTrackedPeople] = useState<any[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<any[]>([]);
  const [studentEvents, setStudentEvents] = useState<any[]>([]);

  const { client, setConfig } = useLiveAPIContext();

  // Reset agent state whenever a presentation starts
  useEffect(() => {
    if (presentationStatus === "in-progress") {
      setTrackedPeople([]);
      setTeacherEvents([]);
      setStudentEvents([]);
      // Optionally reset the viewer pages as well:
      setSlidePage(1);
      setPdfPage(1);
    }
  }, [presentationStatus]);

  // Configure the Gemini API – all tool declarations are now set here.
  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "text",
      },
      systemInstruction: {
        parts: [
          {
            text:
              "You are an assistant to a teacher in a classroom. Your job is to help the teacher by tracking the students and recording teaching events.",
          },
        ],
      },
      tools: [
        { googleSearch: {} },
        {
          functionDeclarations: [
            trackNewPersonDeclaration,
            recordStudentEventDeclaration,
            recordTeacherEventDeclaration,
            searchContentForIdea,
          ],
        },
      ],
    });
  }, [setConfig]);

  // Handle tool calls from the Gemini API and update tracked state
  useEffect(() => {
    const onToolCall = (toolCall: any) => {
      console.log("Received tool call:", toolCall);
      toolCall.functionCalls.forEach((fc: any) => {
        if (fc.name === "record_teacher_event") {
          const args = fc.args as { event: any };
          if (args.event) {
            setTeacherEvents((prev) => [
              ...prev,
              { ...args.event, timestamp: Date.now() },
            ]);
          }
          client.sendToolResponse({
            functionResponses: [
              {
                id: fc.id,
                response: { output: { success: true } },
              },
            ],
          });
        } else if (fc.name === "track_new_person") {
          const args = fc.args as { person: any };
          if (
            args.person &&
            args.person.name &&
            args.person.physical_description &&
            args.person.role &&
            !trackedPeople.some((person) => person.name === args.person.name) &&
            !args.person.name.toLowerCase().includes("unknown")
          ) {
            setTrackedPeople((prev) => [
              ...prev,
              { ...args.person, timestamp: Date.now() },
            ]);
          }
          client.sendToolResponse({
            functionResponses: [
              {
                id: fc.id,
                response: { output: { success: true } },
              },
            ],
          });
        } else if (fc.name === "record_student_event") {
          const args = fc.args as { event: any };
          if (args.event) {
            setStudentEvents((prev) => [
              ...prev,
              { ...args.event, timestamp: Date.now() },
            ]);
          }
        } else if (fc.name === "search_content_for_idea") {
          const args = fc.args as { idea: string; type: string };
          console.log("Searching for content for idea:", args.idea, "of type:", args.type);
        }
      });
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client, trackedPeople]);

  // Presentation control handlers
  const handleStart = () => setPresentationStatus("in-progress");
  const handlePause = () => setPresentationStatus("paused");
  const handleStop = () => setPresentationStatus("stopped");

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        padding: "16px",
        boxSizing: "border-box",
        color: "#231942",
        borderRadius: "8px",
      }}
    >
      <Draggable>
        <div style={{ 
          position: 'absolute',
          border: '8px solid #231942',
          borderRadius: '8px',
          padding: '8px',
          width: !videoRef.current || !videoStream ? '64px' : '640px',
          height: !videoRef.current || !videoStream ? '48px' : '480px',
          zIndex: 1000,
          backgroundColor: '#fff',
          bottom: '16px',
          right: '16px'
        }}>
          {(!videoRef.current || !videoStream) ? (
            <IconButton sx={{ width: '64px', height: '48px' }}>
              <VideocamOff />
            </IconButton>
          ) : (
            <video
              className={cn("stream", {
                hidden: !videoRef.current || !videoStream,
              })}
              ref={videoRef}
              autoPlay
              playsInline
            />
          )}
        </div>
      </Draggable>
      <Draggable>
        <div style={{ 
          position: 'absolute',
          border: '8px solid #231942',
          borderRadius: '8px', 
          padding: '8px',
          maxWidth: '200px',
          zIndex: 1000,
          backgroundColor: '#fff',
          bottom: '16px',
          left: '16px'
        }}>
          <ControlTray
            videoRef={videoRef}
            supportsVideo={true}
            onVideoStreamChange={setVideoStream}
          >
            {/* Additional custom buttons can be added here */}
          </ControlTray>
        </div>
      </Draggable>
      {/* Top Navigation Bar */}
      <AppBar position="static" color="primary" sx={{ mb: 4, borderRadius: "8px" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 , fontSize: '24px'}}>
            Agent Orchestrator
          </Typography>
          <Button
            color={viewMode === "presenter" ? "secondary" : "inherit"}
            onClick={() => setViewMode("presenter")}
          >
            Presenter
          </Button>
          <Button
            color={viewMode === "backend" ? "secondary" : "inherit"}
            onClick={() => setViewMode("backend")}
          >
            Backend
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main content based on view mode */}
      {viewMode === "presenter" ? (
        <Box className="presenter-view">
          <Typography variant="h5" sx={{ mb: 2 }}>
            {/* Presenter View - Status: {presentationStatus} */}
            Presenter View
          </Typography>
          {/* Presentation Controls */}
          {/* <Box sx={{ mb: 2 }}>
            {presentationStatus === "stopped" && (
              <Button variant="contained" color="primary" onClick={handleStart} sx={{ borderRadius: "8px" }}>
                Start Presentation
              </Button>
            )}
            {presentationStatus === "in-progress" && (
              <>
                <Button variant="contained" color="warning" sx={{ mr: 1 }} onClick={handlePause}>
                  Pause Presentation
                </Button>
                <Button variant="contained" color="error" onClick={handleStop}>
                  Stop Presentation
                </Button>
              </>
            )}
            {presentationStatus === "paused" && (
              <>
                <Button variant="contained" color="primary" sx={{ mr: 1 }} onClick={handleStart}>
                  Resume Presentation
                </Button>
                <Button variant="contained" color="error" onClick={handleStop}>
                  Stop Presentation
                </Button>
              </>
            )}
          </Box> */}

          {/* Viewer Display */}
          {/* {presentationStatus !== "stopped" ? ( */}
          {true ? (
            <>
              {presenterMode === "slide" && (
                <SlideViewer page={slidePage} setPage={setSlidePage} />
              )}
              {presenterMode === "pdf" && (
                <PDFViewer page={pdfPage} setPage={setPdfPage} />
              )}
              {presenterMode === "search" && <SearchViewer />}
              {/* Control tray to switch between presentation modes */}
              <Box sx={{ mt: 2, textAlign: "center" }}>
                <ToggleButtonGroup
                  value={presenterMode}
                  exclusive
                  onChange={(_event, newMode) => {
                    if (newMode) setPresenterMode(newMode);
                  }}
                  aria-label="Presentation Mode"
                  color="primary"
                >
                  <ToggleButton value="slide" aria-label="Slide">
                    Slide
                  </ToggleButton>
                  <ToggleButton value="pdf" aria-label="PDF">
                    PDF
                  </ToggleButton>
                  <ToggleButton value="search" aria-label="Search">
                    Search
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </>
          ) : (
            <Typography variant="body1" sx={{ mt: 2 }}>
              Presentation has not started.
            </Typography>
          )}
        </Box>
      ) : (
        // Backend view: if presentation is complete show ReportView,
        // otherwise split the screen between the live log and the tracked state.
        <Box className="backend-view">
          {/* <Typography variant="h5" sx={{ mb: 2 }}>
            Backend View - Status: {presentationStatus}
          </Typography> */}
          <Typography variant="h5" sx={{ mb: 2 }}>
            Backend View
          </Typography>
          {/* {presentationStatus === "stopped" ? ( */}
          {false ? (
            <ReportView />
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, height: "100%" }}>
                <SidePanel />
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, maxHeight: 500, overflow: "auto" }}>
                  <Typography variant="h6" gutterBottom>
                    Lecture Notes
                  </Typography>
                  {/* Tracked People Table */}
                  <Typography variant="subtitle1" sx={{ mt: 2 }}>
                    Attendees
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Things to remember them by...</TableCell>
                          <TableCell>Course role</TableCell>
                          <TableCell>Timestamp</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {trackedPeople.map((person, index) => (
                          <TableRow key={index}>
                            <TableCell>{person.name}</TableCell>
                            <TableCell>{person.physical_description}</TableCell>
                            <TableCell>{person.role}</TableCell>
                            <TableCell>
                              {new Date(person.timestamp).toLocaleTimeString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Teacher Events Table */}
                  <Typography variant="subtitle1" sx={{ mt: 2 }}>
                    Teacher moments
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Description</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>What topic was being discussed?</TableCell>
                          <TableCell>Timestamp</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {teacherEvents.map((event, index) => (
                          <TableRow key={index}>
                            <TableCell>{event.description}</TableCell>
                            <TableCell>{event.type}</TableCell>
                            <TableCell>{event.section}</TableCell>
                            <TableCell>
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Student Events Table */}
                  <Typography variant="subtitle1" sx={{ mt: 2 }}>
                    Student moments
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>What topic was being discussed?</TableCell>
                          <TableCell>Timestamp</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {studentEvents.map((event, index) => (
                          <TableRow key={index}>
                            <TableCell>{event.name}</TableCell>
                            <TableCell>{event.description}</TableCell>
                            <TableCell>{event.type}</TableCell>
                            <TableCell>{event.section}</TableCell>
                            <TableCell>
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}

export default App;
