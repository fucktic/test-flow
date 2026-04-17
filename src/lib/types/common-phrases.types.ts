export type CustomCommonPhrase = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
};

export type CommonPhrasesFileShape = {
  custom: CustomCommonPhrase[];
};
