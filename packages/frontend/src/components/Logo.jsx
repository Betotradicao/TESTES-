export default function Logo({ size = "medium" }) {
  const sizeClasses = {
    small: {
      container: "flex items-center space-x-2",
      icon: "h-8 w-8",
      text: "text-sm"
    },
    medium: {
      container: "flex items-center space-x-3",
      icon: "h-12 w-12",
      text: "text-base"
    },
    large: {
      container: "flex items-center space-x-4",
      icon: "h-16 w-16",
      text: "text-lg"
    }
  };

  const classes = sizeClasses[size];

  return (
    <div className={classes.container}>
      {/* Radar Icon */}
      <div className={`${classes.icon} bg-orange-500 rounded-lg flex items-center justify-center`}>
        <svg className="h-5/6 w-5/6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="7"/>
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 12l7-7"/>
          <circle cx="12" cy="12" r="1" fill="currentColor"/>
          <circle cx="16" cy="8" r="1" fill="currentColor"/>
          <circle cx="8" cy="16" r="1" fill="currentColor"/>
        </svg>
      </div>

      {/* Text */}
      <div className="flex flex-col leading-none text-center">
        <span className={`${classes.text === 'text-sm' ? 'text-base' : classes.text === 'text-base' ? 'text-xl' : 'text-2xl'} font-bold text-orange-500 uppercase`} style={{letterSpacing: '0.25em'}}>
          RADAR
        </span>
        <span className={`${classes.text === 'text-sm' ? 'text-lg' : classes.text === 'text-base' ? 'text-2xl' : 'text-3xl'} font-bold italic text-gray-600 tracking-widest`} style={{marginTop: '-4px'}}>
          360
        </span>
      </div>
    </div>
  );
}