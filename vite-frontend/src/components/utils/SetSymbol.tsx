import React from 'react';
import 'keyrune/css/keyrune.css';

export interface SetSymbolProps {
  setCode: string;
  style?: React.CSSProperties;
  className?: string;
}

const SetSymbol: React.FC<SetSymbolProps> = ({ setCode, style = {}, className = '' }) => {
  const symbolClass = `ss ss-${setCode} ${className}`.trim();
  return <i className={symbolClass} style={style} />;
};

export default SetSymbol;
