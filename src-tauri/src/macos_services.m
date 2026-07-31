#import <AppKit/AppKit.h>
#include <stdlib.h>

typedef void (*OpenExpressServiceCallback)(const char *const *file_paths, size_t file_count);

static OpenExpressServiceCallback g_openexpress_service_callback = NULL;

@interface OpenExpressServiceProvider : NSObject
- (void)openexpressService:(NSPasteboard *)pboard userData:(NSString *)userData error:(NSString **)error;
@end

@implementation OpenExpressServiceProvider

- (void)openexpressService:(NSPasteboard *)pboard userData:(NSString *)userData error:(NSString **)error {
  (void)userData;
  if (g_openexpress_service_callback == NULL) {
    if (error != NULL) {
      *error = @"OpenExpress Services are not ready yet.";
    }
    return;
  }

  NSArray<NSURL *> *urls = [pboard readObjectsForClasses:@[[NSURL class]]
                                                 options:@{NSPasteboardURLReadingFileURLsOnlyKey: @YES}];
  NSMutableArray<NSString *> *paths = [NSMutableArray array];

  for (NSURL *url in urls) {
    if (![url isFileURL]) {
      continue;
    }

    NSString *path = [url path];
    if ([path length] == 0) {
      continue;
    }

    [paths addObject:path];
  }

  if ([paths count] == 0) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    NSArray *filenames = [pboard propertyListForType:NSFilenamesPboardType];
#pragma clang diagnostic pop
    for (id filename in filenames) {
      if ([filename isKindOfClass:[NSString class]] && [filename length] > 0) {
        [paths addObject:filename];
      }
    }
  }

  if ([paths count] > 0) {
    const char **rawPaths = calloc([paths count], sizeof(char *));
    if (rawPaths == NULL) {
      if (error != NULL) {
        *error = @"OpenExpress could not allocate the selected file list.";
      }
      return;
    }
    for (NSUInteger index = 0; index < [paths count]; index++) {
      rawPaths[index] = [paths[index] UTF8String];
    }
    g_openexpress_service_callback(rawPaths, [paths count]);
    free(rawPaths);
    return;
  }

  if (error != NULL) {
    *error = @"OpenExpress could not read the selected file.";
  }
}

@end

static OpenExpressServiceProvider *g_openexpress_service_provider = nil;

void openexpress_register_services_provider(OpenExpressServiceCallback callback) {
  g_openexpress_service_callback = callback;

  if (g_openexpress_service_provider == nil) {
    g_openexpress_service_provider = [[OpenExpressServiceProvider alloc] init];
  }

  [[NSApplication sharedApplication] setServicesProvider:g_openexpress_service_provider];
  NSUpdateDynamicServices();
}
