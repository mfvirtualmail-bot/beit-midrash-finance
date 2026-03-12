'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

const MODULES = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    ['image', 'link'],
    ['clean'],
  ],
}

const FORMATS = [
  'header', 'size',
  'bold', 'italic', 'underline',
  'color', 'background',
  'align',
  'image', 'link',
]

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 min-h-[120px] bg-gray-50 text-gray-400 text-sm">
        {placeholder || 'Loading editor...'}
      </div>
    )
  }

  return (
    <div className="rich-text-editor">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/react-quill@2.0.0/dist/quill.snow.css" />
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={MODULES}
        formats={FORMATS}
        placeholder={placeholder}
      />
      <style jsx global>{`
        .rich-text-editor .ql-container {
          min-height: 120px;
          font-family: 'Segoe UI', Arial, sans-serif;
          direction: rtl;
        }
        .rich-text-editor .ql-editor {
          min-height: 120px;
          direction: rtl;
          text-align: right;
        }
        .rich-text-editor .ql-toolbar {
          border-radius: 8px 8px 0 0;
          border-color: #e2e8f0;
          background: #f8fafc;
        }
        .rich-text-editor .ql-container {
          border-radius: 0 0 8px 8px;
          border-color: #e2e8f0;
        }
      `}</style>
    </div>
  )
}
