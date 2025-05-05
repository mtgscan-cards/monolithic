// CarouselErrorBoundary.tsx
import React from 'react';

interface CanvasErrorBoundaryState {
  hasError: boolean;
}

class CarouselErrorBoundary extends React.Component<{ children: React.ReactNode }, CanvasErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error in Canvas tree:', error, errorInfo);
  }

  render() {
    return this.state.hasError ? <div>Something went wrong in the canvas!</div> : this.props.children;
  }
}

export default CarouselErrorBoundary;
