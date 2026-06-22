//! Shared lopdf utilities for cross-document and intra-document page work.
//! Used by merge, split, and organize commands.

use lopdf::{Document, Object, ObjectId};
use std::collections::BTreeMap;

/// Deep-clone an object (and all objects it references) from `src` doc into
/// `dst` doc. Returns the new ObjectId in the dst document.
pub fn clone_object_deep(src: &Document, src_id: &ObjectId, dst: &mut Document) -> ObjectId {
    let mut id_map: BTreeMap<ObjectId, ObjectId> = BTreeMap::new();
    clone_recursive(src, *src_id, dst, &mut id_map)
}

fn clone_recursive(
    src: &Document,
    src_id: ObjectId,
    dst: &mut Document,
    id_map: &mut BTreeMap<ObjectId, ObjectId>,
) -> ObjectId {
    if let Some(&existing) = id_map.get(&src_id) {
        return existing;
    }

    let new_id = dst.new_object_id();
    id_map.insert(src_id, new_id);

    if let Ok(obj) = src.get_object(src_id) {
        let cloned = remap_object(src, obj.clone(), dst, id_map);
        dst.objects.insert(new_id, cloned);
    }

    new_id
}

fn remap_object(
    src: &Document,
    obj: Object,
    dst: &mut Document,
    id_map: &mut BTreeMap<ObjectId, ObjectId>,
) -> Object {
    match obj {
        Object::Reference(ref_id) => {
            let new_id = clone_recursive(src, ref_id, dst, id_map);
            Object::Reference(new_id)
        }
        Object::Dictionary(dict) => {
            let mut new_dict = lopdf::Dictionary::new();
            for (key, val) in dict.into_iter() {
                new_dict.set(key, remap_object(src, val, dst, id_map));
            }
            Object::Dictionary(new_dict)
        }
        Object::Array(arr) => Object::Array(
            arr.into_iter()
                .map(|v| remap_object(src, v, dst, id_map))
                .collect(),
        ),
        Object::Stream(mut stream) => {
            let mut new_dict = lopdf::Dictionary::new();
            for (key, val) in stream.dict.into_iter() {
                new_dict.set(key, remap_object(src, val, dst, id_map));
            }
            stream.dict = new_dict;
            Object::Stream(stream)
        }
        other => other,
    }
}
