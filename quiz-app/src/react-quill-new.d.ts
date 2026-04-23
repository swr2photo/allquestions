import React from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "react-quill-new" {

  export interface ReactQuillProps {
    theme?: string;
    value?: string;
    defaultValue?: string;
    readOnly?: boolean;
    onChange?: (content: string, delta: any, source: string, editor: any) => void;
    onChangeSelection?: (selection: any, source: string, editor: any) => void;
    onFocus?: (range: any, source: string, editor: any) => void;
    onBlur?: (previousRange: any, source: string, editor: any) => void;
    onKeyPress?: (event: any) => void;
    onKeyDown?: (event: any) => void;
    onKeyUp?: (event: any) => void;
    placeholder?: string;
    modules?: any;
    formats?: string[];
    style?: React.CSSProperties;
    className?: string;
    children?: React.ReactNode;
  }

  export default class ReactQuill extends React.Component<ReactQuillProps> {}
}
