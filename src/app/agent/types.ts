export interface IAgentLocation {
  lat: number;
  lng: number;
}

export interface IAgentPresenceMeta {
  lat: number;
  lng: number;
  lastSeenAt: number;
}

export interface IAgentCandidate {
  agentId: number;
  distance: number;
}

export interface IEarningsFilter {
  from?: Date;
  to?: Date;
}
