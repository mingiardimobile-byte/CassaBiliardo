import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export default function PasswordInput({ value, onChange, placeholder = 'Password', className = '' }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pr-10 w-full"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2 text-gray-400 hover:text-gray-200 transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}