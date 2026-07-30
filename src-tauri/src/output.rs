use crate::{AppError, AppResult};
use std::{
    ffi::OsString,
    io,
    path::{Path, PathBuf},
};
use tempfile::TempPath;

pub struct OutputFile {
    requested: PathBuf,
    temp: TempPath,
}

impl OutputFile {
    pub fn new(requested: impl Into<PathBuf>) -> AppResult<Self> {
        let requested = requested.into();
        if requested.as_os_str().is_empty() {
            return Err(AppError::InvalidInput("Output path is empty.".into()));
        }

        let parent = requested
            .parent()
            .filter(|path| !path.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        let suffix = requested
            .extension()
            .map(|extension| {
                let mut suffix = OsString::from(".");
                suffix.push(extension);
                suffix
            })
            .unwrap_or_default();
        let temp = tempfile::Builder::new()
            .prefix(".openexpress-")
            .suffix(&suffix)
            .tempfile_in(parent)
            .map_err(|error| AppError::from_io(error, parent.to_string_lossy()))?
            .into_temp_path();

        Ok(Self { requested, temp })
    }

    pub fn path(&self) -> &Path {
        &self.temp
    }

    pub fn commit(self) -> AppResult<PathBuf> {
        let Self {
            requested,
            mut temp,
        } = self;

        for index in 0..10_000 {
            let candidate = numbered_path(&requested, index);
            match temp.persist_noclobber(&candidate) {
                Ok(()) => return Ok(candidate),
                Err(error) if error.error.kind() == io::ErrorKind::AlreadyExists => {
                    temp = error.path;
                }
                Err(error) => {
                    return Err(AppError::from_io(error.error, candidate.to_string_lossy()))
                }
            }
        }

        Err(AppError::Io(format!(
            "Could not find an unused output name for {}",
            requested.display()
        )))
    }
}

pub fn write_output(
    requested: impl Into<PathBuf>,
    write: impl FnOnce(&Path) -> AppResult<()>,
) -> AppResult<String> {
    let output = OutputFile::new(requested)?;
    write(output.path())?;
    Ok(output.commit()?.to_string_lossy().into_owned())
}

fn numbered_path(requested: &Path, index: usize) -> PathBuf {
    if index == 0 {
        return requested.to_path_buf();
    }

    let stem = requested.file_stem().unwrap_or(requested.as_os_str());
    let mut name = stem.to_os_string();
    name.push(format!(" ({index})"));
    if let Some(extension) = requested.extension() {
        name.push(".");
        name.push(extension);
    }
    requested.with_file_name(name)
}

#[cfg(test)]
mod tests {
    use super::OutputFile;

    #[test]
    fn commits_without_overwriting_an_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let requested = dir.path().join("result.png");
        std::fs::write(&requested, b"existing").unwrap();

        let output = OutputFile::new(&requested).unwrap();
        std::fs::write(output.path(), b"new").unwrap();
        let committed = output.commit().unwrap();

        assert_eq!(std::fs::read(&requested).unwrap(), b"existing");
        assert_eq!(committed, dir.path().join("result (1).png"));
        assert_eq!(std::fs::read(committed).unwrap(), b"new");
    }

    #[test]
    fn removes_partial_output_when_dropped() {
        let dir = tempfile::tempdir().unwrap();
        let output = OutputFile::new(dir.path().join("result.png")).unwrap();
        let temp_path = output.path().to_path_buf();
        std::fs::write(&temp_path, b"partial").unwrap();

        drop(output);

        assert!(!temp_path.exists());
    }
}
