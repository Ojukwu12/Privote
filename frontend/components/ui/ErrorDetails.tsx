"use client";

import React, { useState } from 'react';

interface Props {
  error?: any;
}

export function ErrorDetails({ error }: Props) {
  const [open, setOpen] = useState(false);

  if (!error) return null;

  const asJson = typeof error?.toJSON === 'function' ? error.toJSON() : (error?.response || error || {});

  return (
    <div className="mt-2">
      <button className="text-xs underline" onClick={() => setOpen(!open)}>
        {open ? 'Hide details' : 'Show details'}
      </button>
      {open && (
        <pre className="mt-2 p-2 bg-gray-50 text-xs rounded border overflow-auto max-h-48">{JSON.stringify(asJson, null, 2)}</pre>
      )}
    </div>
  );
}

export default ErrorDetails;
