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

import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import { RiSidebarFoldLine, RiSidebarUnfoldLine } from "react-icons/ri";
import Select from "react-select";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { useLoggerStore } from "../../lib/store-logger";
import Logger, { LoggerFilterType } from "../logger/Logger";
import "./side-panel.scss";

// Importing MUI components and icons
import { Box, IconButton, Typography, Chip, TextField, Button } from "@mui/material";
import OnlinePredictionIcon from "@mui/icons-material/OnlinePrediction";
import PauseCircleFilledIcon from "@mui/icons-material/PauseCircleFilled";

const filterOptions = [
  { value: "conversations", label: "Conversations" },
  { value: "tools", label: "Tool Use" },
  { value: "none", label: "All" },
];

export default function SidePanel() {
  const { connected, client } = useLiveAPIContext();
  const [open, setOpen] = useState(true);
  const loggerRef = useRef<HTMLDivElement>(null);
  const loggerLastHeightRef = useRef<number>(-1);
  const { log, logs } = useLoggerStore();

  const [textInput, setTextInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<{ value: string; label: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll the log to the bottom when new logs come in
  useEffect(() => {
    if (loggerRef.current) {
      const el = loggerRef.current;
      const scrollHeight = el.scrollHeight;
      if (scrollHeight !== loggerLastHeightRef.current) {
        el.scrollTop = scrollHeight;
        loggerLastHeightRef.current = scrollHeight;
      }
    }
  }, [logs]);

  // Listen for log events and store them
  useEffect(() => {
    client.on("log", log);
    return () => {
      client.off("log", log);
    };
  }, [client, log]);

  const handleSubmit = () => {
    client.send([{ text: textInput }]);
    setTextInput("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className={`side-panel ${open ? "open" : ""}`} style={{ }}>
      {/* Header using MUI Box, Typography and IconButton */}
      <Box 
        component="header" 
        className="top" 
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1 }}
      >
        <Typography variant="h6" sx={{ color: "#231942", fontWeight: "bold" }}>
          Console
        </Typography>
        {open ? (
          <IconButton onClick={() => setOpen(false)} sx={{ color: "#231942" }}>
            <RiSidebarFoldLine />
          </IconButton>
        ) : (
          <IconButton onClick={() => setOpen(true)} sx={{ color: "#231942" }}>
            <RiSidebarUnfoldLine />
          </IconButton>
        )}
      </Box>

      {/* Indicators section with react-select and a streaming/paused indicator as a MUI Chip */}
      <Box 
        component="section" 
        className="indicators" 
        sx={{ display: "flex", alignItems: "center", gap: 2, p: 1 }}
      >
        <Select
          className="react-select"
          classNamePrefix="react-select"
          styles={{
            control: (baseStyles) => ({
              ...baseStyles,
              background: "var(--Neutral-15)",
              color: "var(--Neutral-90)",
              minHeight: "33px",
              maxHeight: "33px",
              border: 0,
            }),
            option: (styles, { isFocused, isSelected }) => ({
              ...styles,
              backgroundColor: isFocused
                ? "var(--Neutral-30)"
                : isSelected
                  ? "var(--Neutral-20)"
                  : undefined,
            }),
          }}
          defaultValue={selectedOption}
          options={filterOptions}
          onChange={(e) => {
            setSelectedOption(e);
          }}
        />
        <Chip
          icon={connected ? <OnlinePredictionIcon /> : <PauseCircleFilledIcon />}
          label={open ? (connected ? "Streaming" : "Paused") : ""}
          sx={{
            backgroundColor: "#231942",
            color: "#fff",
            fontWeight: "bold",
          }}
        />
      </Box>

      {/* Log Container */}
      <Box 
        ref={loggerRef} 
        className="side-panel-container" 
        sx={{ 
          overflowY: "auto", 
          color: "#231942",
          maxHeight: "60%" // Add max height to limit log display
        }}
      >
        <Logger filter={(selectedOption?.value as LoggerFilterType) || "none"} />
      </Box>

      {/* Input area using MUI TextField and Button */}
      <Box 
        className={cn("input-container", { disabled: !connected })}
        sx={{ display: "flex", alignItems: "center", p: 1 }}
      >
        <TextField
          multiline
          variant="outlined"
          placeholder="Type something..."
          inputRef={inputRef}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          onChange={(e) => setTextInput(e.target.value)}
          value={textInput}
          fullWidth
          sx={{
            backgroundColor: "var(--Neutral-15)",
            color: "#231942",
            "& .MuiInputBase-input": { color: "#231942" },
          }}
        />
        <Button
          variant="contained"
          onClick={handleSubmit}
          sx={{ backgroundColor: "#231942", color: "#fff", ml: 1 }}
        >
          Send
        </Button>
      </Box>
    </div>
  );
}
