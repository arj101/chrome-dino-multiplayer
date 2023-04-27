use std::collections::HashMap;
use std::fs;
use std::io::prelude::*;
use std::path::Path;

use image::GenericImageView;

fn main() {
    println!("cargo:rerun-if-changed=./sprites/");

    let output_path = "./src/obstacles.rs";
    let mut file = fs::File::create(output_path).unwrap();
    let mut enums = HashMap::new();

    let mut cactuses = vec![];

    writeln!(file, "use rand::rngs::ThreadRng;").unwrap();
    writeln!(file, "use rand::Rng;").unwrap();
    writeln!(file, "use serde::Serialize;").unwrap();

    writeln!(file).unwrap();

    writeln!(file, "#[derive(Clone, Copy, Serialize, PartialEq, Debug)]").unwrap();
    writeln!(file, "pub enum Obstacle {{").unwrap();
    fs::read_dir("./sprites")
        .unwrap()
        .map(|f| f.unwrap().file_name())
        .for_each(|f| {
            let f = f.to_str().unwrap().to_owned();
            let path = Path::new(&f);
            let enum_name = filename_to_enum(&path.file_stem().unwrap().to_string_lossy());
            writeln!(file, "    {},", enum_name).unwrap();
            if enum_name.starts_with("Cactus") {
                cactuses.push(enum_name.clone());
            }
            enums.insert(enum_name, f);
        });
    writeln!(file, "}}").unwrap();

    writeln!(file).unwrap();

    let dino_height = image::open("./sprites/dino-run-1.png")
        .unwrap()
        .dimensions()
        .1 as f32;

    writeln!(
        file,
        "pub fn obstacle_size(obstacle: &Obstacle) -> (f32, f32) {{"
    )
    .unwrap();
    writeln!(file, "    match obstacle {{").unwrap();
    for (e, image) in enums {
        let image_size = image::open(format!("./sprites/{}", image))
            .unwrap()
            .dimensions();
        let image_size = (image_size.0 as f32, image_size.1 as f32);
        writeln!(
            file,
            "      Obstacle::{} => ({} as f32, {} as f32),",
            e,
            image_size.0 / dino_height,
            image_size.1 / dino_height
        )
        .unwrap();
    }
    writeln!(file, "    }}").unwrap();
    writeln!(file, "}}").unwrap();

    writeln!(file).unwrap();

    writeln!(
        file,
        "pub fn random_cactus(rng: &mut ThreadRng) -> Obstacle {{"
    )
    .unwrap();
    writeln!(
        file,
        "    match rng.gen_range(0..={}) {{",
        cactuses.len() - 1
    )
    .unwrap();
    for (index, cactus) in cactuses.iter().enumerate() {
        writeln!(file, "        {} => Obstacle::{},", index, cactus).unwrap();
    }
    writeln!(file, "        _ => unreachable!(),").unwrap();
    writeln!(file, "    }}").unwrap();
    writeln!(file, "}}").unwrap();

    writeln!(file).unwrap();

    writeln!(
        file,
        "pub const TALLEST_CACTUS: Obstacle = Obstacle::CactusBig1;"
    )
    .unwrap();
}

fn filename_to_enum(name: &str) -> String {
    name.split("-")
        .filter(|word| word.len() != 0)
        .map(|word| {
            if word.chars().next().unwrap().is_alphabetic() {
                let mut word = word.to_owned();
                word.get_mut(0..1).unwrap().make_ascii_uppercase();
                word
            } else {
                word.to_owned()
            }
        })
        .collect()
}
