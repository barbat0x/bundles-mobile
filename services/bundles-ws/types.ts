export type WsRequest = {
  id: number;
  route: string;
  data: unknown;
};

export type WsResponse = {
  id: number;
  data: unknown;
  error?: boolean;
};
