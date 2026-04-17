export type ClientApiConfig = {
  imageModelApiKey: string;
  imageModelExample: string;
  videoModelApiKey: string;
  videoModelExample: string;
  imgbbApiKey: string;
};

export const defaultClientApiConfig: ClientApiConfig = {
  imageModelApiKey: "",
  imageModelExample: "",
  videoModelApiKey: "",
  videoModelExample: "",
  imgbbApiKey: "",
};
