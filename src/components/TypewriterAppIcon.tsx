import React from 'react';

interface TypewriterAppIconProps {
  className?: string;
}

export const TypewriterAppIcon: React.FC<TypewriterAppIconProps> = ({ className = 'w-full h-full' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      aria-label="Máquina de escribir"
    >
      {/* Circular Base Background */}
      <circle cx="256" cy="256" r="240" fill="#364353" />

      {/* Paper Sheet */}
      <rect x="156" y="80" width="200" height="180" rx="4" fill="#FFFFFF" />
      {/* Paper Text Lines */}
      <rect x="180" y="104" width="76" height="6" rx="3" fill="#D1D5DB" />
      <rect x="180" y="118" width="152" height="6" rx="3" fill="#D1D5DB" />
      <rect x="180" y="132" width="152" height="6" rx="3" fill="#D1D5DB" />
      <rect x="180" y="146" width="152" height="6" rx="3" fill="#D1D5DB" />
      <rect x="180" y="160" width="130" height="6" rx="3" fill="#D1D5DB" />

      {/* Carriage Roller Bar / Platen */}
      <rect x="125" y="172" width="262" height="16" rx="4" fill="#0E1726" />
      <rect x="135" y="176" width="242" height="3" fill="#00D2D3" />

      {/* Carriage Side Knobs & Lever */}
      {/* Left Knob */}
      <rect x="100" y="170" width="18" height="52" rx="4" fill="#E5E7EB" />
      <rect x="104" y="174" width="10" height="44" rx="2" fill="#9CA3AF" />
      <rect x="118" y="186" width="10" height="20" rx="2" fill="#6B7280" />
      {/* Right Lever */}
      <rect x="375" y="176" width="22" height="24" rx="3" fill="#E5E7EB" />
      <path d="M397 190 L406 190 L406 156 L414 156 L414 140 L400 140 L400 156 L397 156 Z" fill="#E5E7EB" />

      {/* Typewriter Main Top Body (Cyan / Turquoise) */}
      <path d="M125 192 L387 192 Q387 230 380 315 L132 315 Q125 230 125 192 Z" fill="#00C8D7" />

      {/* Typebar Basket / Arc (Dark Slate & Radiating Metal Bars) */}
      <path d="M165 200 C165 275 347 275 347 200 Z" fill="#202A36" />

      {/* Typebars radiating metal fan */}
      <g stroke="#E5E7EB" strokeWidth="2.5" opacity="0.95">
        <line x1="256" y1="214" x2="256" y2="265" />
        <line x1="256" y1="214" x2="246" y2="264" />
        <line x1="256" y1="214" x2="266" y2="264" />
        <line x1="256" y1="214" x2="236" y2="262" />
        <line x1="256" y1="214" x2="276" y2="262" />
        <line x1="256" y1="214" x2="226" y2="259" />
        <line x1="256" y1="214" x2="286" y2="259" />
        <line x1="256" y1="214" x2="217" y2="254" />
        <line x1="256" y1="214" x2="295" y2="254" />
        <line x1="256" y1="214" x2="209" y2="248" />
        <line x1="256" y1="214" x2="303" y2="248" />
        <line x1="256" y1="214" x2="202" y2="240" />
        <line x1="256" y1="214" x2="310" y2="240" />
        <line x1="256" y1="214" x2="196" y2="231" />
        <line x1="256" y1="214" x2="316" y2="231" />
        <line x1="256" y1="214" x2="191" y2="221" />
        <line x1="256" y1="214" x2="321" y2="221" />
      </g>
      <path d="M190 205 C200 248 312 248 322 205 Z" fill="#202A36" />
      {/* Central Type guide */}
      <rect x="251" y="196" width="10" height="22" rx="2" fill="#E5E7EB" />

      {/* Left and Right Turquoise Spool Wheels */}
      <circle cx="180" cy="204" r="20" fill="#00E5FF" />
      <circle cx="180" cy="204" r="7" fill="#FFFFFF" />
      <circle cx="332" cy="204" r="20" fill="#00E5FF" />
      <circle cx="332" cy="204" r="7" fill="#FFFFFF" />

      {/* Ribbon guide plate */}
      <rect x="200" y="294" width="112" height="12" rx="3" fill="#FFFFFF" opacity="0.95" />

      {/* Dark Horizontal Separator */}
      <rect x="120" y="312" width="272" height="8" fill="#18232C" />

      {/* Keyboard Base Housing (Cyan Lower Body) */}
      <path d="M120 320 L392 320 L382 414 Q382 422 372 422 L140 422 Q130 422 130 414 Z" fill="#00C8D7" />

      {/* Keyboard Well (Dark Charcoal) */}
      <rect x="146" y="342" width="220" height="66" rx="6" fill="#1F2937" />

      {/* Round White Keyboard Keys */}
      {/* Row 1 */}
      <g fill="#FFFFFF">
        <circle cx="166" cy="355" r="5" />
        <circle cx="182" cy="355" r="5" />
        <circle cx="198" cy="355" r="5" />
        <circle cx="214" cy="355" r="5" />
        <circle cx="230" cy="355" r="5" />
        <circle cx="246" cy="355" r="5" />
        <circle cx="262" cy="355" r="5" />
        <circle cx="278" cy="355" r="5" />
        <circle cx="294" cy="355" r="5" />
        <circle cx="310" cy="355" r="5" />
        <circle cx="326" cy="355" r="5" />
        <circle cx="342" cy="355" r="5" />
      </g>
      {/* Row 2 */}
      <g fill="#FFFFFF">
        <circle cx="160" cy="371" r="5" />
        <circle cx="176" cy="371" r="5" />
        <circle cx="192" cy="371" r="5" />
        <circle cx="208" cy="371" r="5" />
        <circle cx="224" cy="371" r="5" />
        <circle cx="240" cy="371" r="5" />
        <circle cx="256" cy="371" r="5" />
        <circle cx="272" cy="371" r="5" />
        <circle cx="288" cy="371" r="5" />
        <circle cx="304" cy="371" r="5" />
        <circle cx="320" cy="371" r="5" />
        <circle cx="336" cy="371" r="5" />
        <circle cx="352" cy="371" r="5" />
      </g>
      {/* Row 3 */}
      <g fill="#FFFFFF">
        <circle cx="168" cy="387" r="5" />
        <circle cx="184" cy="387" r="5" />
        <circle cx="200" cy="387" r="5" />
        <circle cx="216" cy="387" r="5" />
        <circle cx="232" cy="387" r="5" />
        <circle cx="248" cy="387" r="5" />
        <circle cx="264" cy="387" r="5" />
        <circle cx="280" cy="387" r="5" />
        <circle cx="296" cy="387" r="5" />
        <circle cx="312" cy="387" r="5" />
        <circle cx="328" cy="387" r="5" />
        <circle cx="344" cy="387" r="5" />
      </g>
      {/* Row 4: Spacebar & Bottom Keys */}
      <g fill="#FFFFFF">
        <circle cx="178" cy="401" r="4.5" />
        <circle cx="194" cy="401" r="4.5" />
        {/* Spacebar */}
        <rect x="210" y="397" width="92" height="8" rx="4" fill="#FFFFFF" />
        <circle cx="318" cy="401" r="4.5" />
        <circle cx="334" cy="401" r="4.5" />
      </g>
    </svg>
  );
};
