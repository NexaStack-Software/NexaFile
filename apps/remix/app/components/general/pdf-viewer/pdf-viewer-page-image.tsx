import { Trans } from '@lingui/react/macro';

import type { ImageLoadingState } from '@nexasign/lib/client-only/providers/envelope-render-provider';
import { cn } from '@nexasign/ui/lib/utils';
import { Spinner } from '@nexasign/ui/primitives/spinner';

type PdfViewerPageImageProps = {
  imageLoadingState: ImageLoadingState;
  imageProps: React.ImgHTMLAttributes<HTMLImageElement> & Record<string, unknown> & { alt: '' };
};

export const PdfViewerPageImage = ({ imageLoadingState, imageProps }: PdfViewerPageImageProps) => {
  return (
    <>
      {/* Loading State */}
      {imageLoadingState === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-muted-foreground opacity-20">
          <Spinner />
        </div>
      )}

      {imageLoadingState === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p>
            <Trans>Error loading page</Trans>
          </p>
        </div>
      )}

      {/* The PDF image. */}
      {imageProps.src && (
        <img
          {...imageProps}
          className={cn(imageProps.className, 'select-none')}
          draggable={false}
          alt=""
        />
      )}
    </>
  );
};
