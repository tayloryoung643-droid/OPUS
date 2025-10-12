import OpusAgendaMock from "../features/agenda/OpusAgendaMock";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import OpusTopNav from "@/components/Opus/TopNav";
import OpusOrb from "@/components/Opus/OpusOrb";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CONFIG } from "@/config";

export default function Agenda() {
  return <OpusAgendaMock />;
}