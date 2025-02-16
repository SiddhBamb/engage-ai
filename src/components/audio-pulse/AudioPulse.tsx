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

import React, { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import { SxProps, Theme } from "@mui/material/styles";

const lineCount = 3;

export type AudioPulseProps = {
  active: boolean;
  volume: number;
  hover?: boolean;
};

export default function AudioPulse({ active, volume, hover }: AudioPulseProps) {
  const lines = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    let timeout: number | null = null;
    const update = () => {
      lines.current.forEach((line, i) => {
        line.style.height = `${Math.min(24, 4 + volume * (i === 1 ? 400 : 60))}px`;
      });
      timeout = window.setTimeout(update, 100);
    };

    update();

    return () => {
      if (timeout !== null) clearTimeout(timeout);
    };
  }, [volume]);

  const containerStyle: SxProps<Theme> = {
    display: "flex",
    alignItems: "flex-end",
    height: 24,
    ...(hover && {
      cursor: "pointer",
    }),
  };

  const lineStyle: SxProps<Theme> = {
    width: 4,
    height: 4,
    backgroundColor: active ? "primary.main" : "grey.400",
    borderRadius: 1,
    mx: 0.5,
    transition: "height 0.1s linear",
  };

  return (
    <Box sx={containerStyle}>
      {Array.from({ length: lineCount }).map((_, i) => (
        <Box
          key={i}
          ref={(el: HTMLDivElement) => (lines.current[i] = el)}
          sx={{
            ...lineStyle,
            animationDelay: `${i * 133}ms`,
          }}
        />
      ))}
    </Box>
  );
}
