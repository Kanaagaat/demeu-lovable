type IconProps = {
  name: string;
  color?: string;
  style?: string;
  size?: number;
};

export function Icon({ name, color = '6755B2', style = 'fluency-systems-regular', size = 24 }: IconProps) {
  const src = `/icons/${encodeURIComponent(style)}/${encodeURIComponent(color.replace(/^#/, '').toUpperCase())}/${encodeURIComponent(name)}.png`;
  return (
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="shrink-0 object-contain"
      onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
    />
  );
}
