/* 
TODO: 
- bring back batched logging function calls
- 

*/


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

import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";

// -----------------------------------------------------------------------------
// Material UI components
// -----------------------------------------------------------------------------
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";

// -----------------------------------------------------------------------------
// Data Structures
// -----------------------------------------------------------------------------


const lecture_sections = [
  {
    title: "Intro to Calculus",
    description: "This section covers the basics of calculus, including limits, derivatives, and integrals.",
  },
  {
    title: "Derivatives",
    description: "This section covers the basics of derivatives, including how to find the derivative of a function at a point.",
  },
  {
    title: "Applications of Derivatives",
    description: "This section covers the applications of derivatives, including optimization and related rates.",
  },
  {
    title: "Integration and the Fundamental Theorem of Calculus",
    description: "This section covers the basics of integrals, including how to find the integral of a function at a point.",
  },
  {
    title: "Applications of Integration",
    description: "This section covers the applications of integration, including area under a curve and volume of a solid.",
  },
]

// Represents a person tracked by the system.
interface Person {
  name: string;
  physical_description: string;
  role: "student" | "teacher";
}


// Represents an event that occurred during teaching.
interface StudentEvent {
  name: string;
  description: string;
  type: "correction" | "misunderstanding" | "clarification" | "comment" | "distraction";
  section: string;
}

// Represents an event that occurred during teaching.
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

// -----------------------------------------------------------------------------
// Function Declarations
// -----------------------------------------------------------------------------

const trackNewPersonDeclaration: FunctionDeclaration = {
  name: "track_new_person",
  description: "Wait for someone to introduce themselves to you expicitly with 'I'm ...'. When they do, store their name and physical description as well as whether they are a student or teacher.",
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
  description: "Records a teacher event. This can either be a standalone idea or concept that they explained, or feedback on their teaching style. For example, if the teacher explained a new concept or if they went too fast through a piece of material, you should note it!",
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
            description: "The section of the lecture that the teacher event is in. This should be one of the following: " + lecture_sections.map((s) => `"${s.title}"`).join(", ") + ', "Miscellaneous"', // TODO: consider making this include descriptions
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
  description: "Records a student event for a person (you must have already been introduced to them). Call this function when you observe a student event. For example, if the student asks a question, looks confused, looks distracted, or seems like they are following along, note these things!",
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
            description: "The section of the lecture that the student event is in. This should be one of the following: " + lecture_sections.map((s) => `"${s.title}"`).join(", ") + ', "Miscellaneous"', // TODO: consider making this include descriptions
          },
        },
        required: ["name", "description", "type", "section"],
      },
    },
    required: ["event"],
  },
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

function EngageComponent() {
  const { client, setConfig } = useLiveAPIContext();

  // Data state for tracked people and teaching events
  const [trackedPeople, setTrackedPeople] = useState<TPerson[]>([]);
  const [studentEvents, setStudentEvents] = useState<TStudentEvent[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TTeacherEvent[]>([]);
  // Ref to hold the most up-to-date tracked people (used in tool responses)
  const trackedPeopleRef = useRef(trackedPeople);
  const studentEventsRef = useRef(studentEvents);
  const teacherEventsRef = useRef(teacherEvents);
  useEffect(() => {
    trackedPeopleRef.current = trackedPeople;
    studentEventsRef.current = studentEvents;
    teacherEventsRef.current = teacherEvents;
  }, [trackedPeople, studentEvents, teacherEvents]);

  // Set up the configuration with our new tool (function) declarations.
  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "text",
      },
      systemInstruction: {
        parts: [
          {
            text: "You are a assistant to a teacher in a classroom. The teacher is teaching a small class of students that are facing you. Your job is to help the teacher by tracking the students and observing their engagement with the lesson. You will also observe the teacher and record their teaching style and interactions with the students. You will also record the section of the lecture that events occur in.",
          },
        ],
      },
      tools: [
        { googleSearch: {} },
        // { },
        {
          functionDeclarations: [
            trackNewPersonDeclaration,
            recordStudentEventDeclaration,
            recordTeacherEventDeclaration,
          ],
        },
      ],
    });
  }, [setConfig]);

  // Toolcall event handler to update our data structures.
  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      console.log("all data", {
        trackedPeople,
        studentEvents,
        teacherEvents,
      });
      toolCall.functionCalls.forEach((fc) => {
        if (fc.name === "record_teacher_event") {
          // Expects args: { event: TeacherEvent }
          const args = fc.args as { event: TeacherEvent };
          console.log("record_teacher_event", args);
          if (args.event) {
            setTeacherEvents((prev) => [
              ...prev,
              {
                ...args.event,
                timestamp: Date.now(),
              },
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
          // Expects args: { person: Person }
          const args = fc.args as { person: Person };
          console.log("track_new_person", args);
          if (args.person.name && args.person.physical_description && args.person.role && !trackedPeople.some(person => person.name === args.person!.name) && !args.person.name.includes("unknown")) {
            setTrackedPeople((prev) => [...prev, { ...args.person!, timestamp: Date.now() }]);
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
          // Expects args: { event: StudentEvent }
          const args = fc.args as { event: StudentEvent };
          console.log("record_student_event", args);
          if (args.event) {
            setStudentEvents((prev) => [
              ...prev,
              {
                ...args.event,
                timestamp: Date.now(),
              },
            ]);
          }
        }
      });
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Visualization of Tracked Data
      </Typography>
      <Grid container spacing={4}>
        {/* Tracked People */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Tracked People
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Physical Description</TableCell>
                  <TableCell>Role</TableCell>
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
        </Grid>

        {/* Teaching Events */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Teaching Events
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell>Event Type</TableCell>
                  <TableCell>Section</TableCell>
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
        </Grid>

        {/* Student Events */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Student Events
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Event Type</TableCell>
                  <TableCell>Section</TableCell>
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
        </Grid>
      </Grid>
    </Container>
  );
}

export const Engage = memo(EngageComponent);
