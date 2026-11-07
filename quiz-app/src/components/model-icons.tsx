import React from 'react';

export const ModelIcons = {
  openai: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0462 6.0462 0 0 0 5.7718-4.2057 5.9847 5.9847 0 0 0 3.9893-2.9001 6.0462 6.0462 0 0 0-.7391-7.0731z" />
      <path d="M12.2435 2.146v4.062M16.5492 4.6309l-3.5181 2.031M21.2003 10.9859l-3.5181-2.031M21.2003 15.0482l-3.5181 2.031M16.5492 21.3195l-3.5181-2.031M12.2435 23.8043v-4.062M7.9379 21.3195l3.5181-2.031M3.2868 15.0482l3.5181 2.031M3.2868 10.9859l3.5181-2.031M7.9379 4.6309l3.5181 2.031" />
    </svg>
  ),
  meta: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 12c-1.5-3-4-6-8-6-4.5 0-4.5 12 0 12 4 0 6.5-3 8-6zm0 0c1.5 3 4 6 8 6 4.5 0 4.5-12 0-12-4 0-6.5 3-8 6z" />
    </svg>
  ),
  google: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  ),
  anthropic: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.8 2.2L12 20.8l-6.8-18.6H1.5L12 24l10.5-21.8h-3.7z" />
    </svg>
  ),
  microsoft: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
    </svg>
  ),
  deepseek: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8zm1-11h-2v6h2zm-1 8a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 12 17z" />
    </svg>
  ),
  mistral: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M2.5 4L12 19L21.5 4H16L12 11L8 4H2.5Z" />
    </svg>
  ),
  cohere: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2A10 10 0 1 0 22 12 10 10 0 0 0 12 2zm0 14a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
    </svg>
  ),
  groq: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2L2 22h20L12 2zm0 4l6 14H6l6-14z" />
      <path d="M12 10l3 7H9l3-7z" />
    </svg>
  ),
  nvidia: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12c3.314 0 6.314-1.343 8.485-3.515l-1.414-1.414C17.41 20.732 14.81 22 12 22c-5.523 0-10-4.477-10-10S6.477 2 12 2c2.81 0 5.41 1.268 7.071 3.271l1.414-1.414C18.314 1.343 15.314 0 12 0z" />
      <path d="M12 4c-4.418 0-8 3.582-8 8s3.582 8 8 8c2.209 0 4.209-0.895 5.657-2.343l-1.414-1.414C15.253 17.233 13.753 18 12 18c-3.314 0-6-2.686-6-6s2.686-6 6-6c1.753 0 3.253 0.767 4.243 2.01l1.414-1.414C16.209 4.895 14.209 4 12 4z" />
      <path d="M12 8c-2.209 0-4 1.791-4 4s1.791 4 4 4c1.105 0 2.105-0.448 2.828-1.172l-1.414-1.414C13.063 13.757 12.563 14 12 14c-1.105 0-2-0.895-2-2s0.895-2 2-2c0.563 0 1.063 0.243 1.414 0.586l1.414-1.414C14.105 8.448 13.105 8 12 8z" />
    </svg>
  ),
  gemini: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
    </svg>
  ),
  moonshot: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  typhoon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 12h-6M22 8h-9M16 16H8M12 20H4" />
    </svg>
  ),
};
