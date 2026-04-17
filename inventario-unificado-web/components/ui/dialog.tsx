import React, { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          zIndex: 40,
        }}
        onClick={() => onOpenChange(false)}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            boxShadow: '0 20px 40px rgba(2, 6, 23, 0.22)',
            maxWidth: 1160,
            width: '100%',
            border: '1px solid #e2e8f0',
            maxHeight: '90vh',
            overflow: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
}

export function DialogContent({
  children,
  className: _className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div>{children}</div>;
}

export function DialogHeader({
  children,
  className: _className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      style={{
        padding: '18px 22px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}
    >
      {children}
    </div>
  );
}

export function DialogTitle({
  children,
  className: _className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.1 }}>{children}</h2>;
}

export function DialogDescription({
  children,
  className: _className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      style={{
        margin: '8px 0 0',
        color: '#64748b',
        fontSize: 14,
      }}
    >
      {children}
    </p>
  );
}
