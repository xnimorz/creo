import { RecordOf } from "../data-structures/record/Record";

export type Context = {
  tracked: <T extends {}>(t: T) => RecordOf<T>;
  lowLevel: () => void;
};
